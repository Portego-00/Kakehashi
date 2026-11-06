import { CommonActions, isActionHandled, StackActions, StackRouter, type StackNavigationState } from "expo-router/react-navigation";
import { goBackFromCustomVocabulary } from "../navigation";

jest.mock("expo-router", () => ({ router: {} }));

function stack(routeNames: string[]) {
  const router = StackRouter({ initialRouteName: routeNames[0] });
  const options = { routeNames, routeGetIdList: {} };
  // SDK 58 builds initial state from the URL; this fixture supplies that state.
  let state: StackNavigationState<Record<string, object | undefined>> = {
    stale: false,
    type: "stack",
    key: "test-stack",
    routeKeySeq: 1,
    index: 0,
    routeNames,
    routes: [{ key: `${routeNames[0]}-initial`, name: routeNames[0] }],
  };
  const dispatch = (action: ReturnType<typeof StackActions.push> | ReturnType<typeof CommonActions.goBack>) => {
    const next = router.getStateForAction(state, action, options);
    if (!isActionHandled(next)) throw new Error("Expected the navigation action to be handled");
    state = next.state;
  };
  return {
    getState: () => state,
    push: (name: string, params?: object) => dispatch(StackActions.push(name, params)),
    canGoBack: () => isActionHandled(router.getStateForAction(state, CommonActions.goBack(), options)),
    back: () => dispatch(CommonActions.goBack()),
    replace: jest.fn(),
  };
}

it("pops a session to the exact existing pack entry and preserves its params", () => {
  const navigation = stack(["packs", "lessons"]);
  navigation.push("packs", { packId: "conversation-glue", query: "やっぱり" });
  const origin = navigation.getState().routes[1];
  navigation.push("lessons", { packId: "conversation-glue" });
  goBackFromCustomVocabulary("/custom-vocabulary", navigation);
  expect(navigation.getState().routes).toHaveLength(2);
  expect(navigation.getState().routes[1]).toBe(origin);
  expect(navigation.getState().routes[1].params).toEqual({ packId: "conversation-glue", query: "やっぱり" });
  expect(navigation.replace).not.toHaveBeenCalled();
});

it("returns from the nested pack root through its parent stack to the dashboard", () => {
  const parent = stack(["dashboard", "custom-vocabulary"]);
  const child = stack(["index", "lessons"]);
  const dashboard = parent.getState().routes[0];
  parent.push("custom-vocabulary");
  const navigation = {
    canGoBack: () => child.canGoBack() || parent.canGoBack(),
    back: () => child.canGoBack() ? child.back() : parent.back(),
    replace: jest.fn(),
  };
  goBackFromCustomVocabulary("/(app)/(tabs)", navigation);
  expect(parent.getState().routes).toEqual([dashboard]);
  expect(child.getState().routes).toHaveLength(1);
  expect(navigation.replace).not.toHaveBeenCalled();
});

it("only uses a fallback for a direct link with no previous screen", () => {
  const navigation = stack(["lessons"]);
  goBackFromCustomVocabulary("/custom-vocabulary", navigation);
  expect(navigation.replace).toHaveBeenCalledWith("/custom-vocabulary");
  const root = stack(["packs"]);
  goBackFromCustomVocabulary("/(app)/(tabs)", root);
  expect(root.replace).toHaveBeenCalledWith("/(app)/(tabs)");
});
