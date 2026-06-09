import React from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function BunproSurveyModal() {
  const {
    bunproFeatureRequestInput,
    bunproIntegrationAnswer,
    bunproUsageAnswer,
    handleBunproUsageSelection,
    handleSubmitBunproSurvey,
    isSubmittingBunproSurvey,
    modalHeaderPaddingTop,
    setBunproFeatureRequestInput,
    setBunproIntegrationAnswer,
    setShowBunproSurveyModal,
    showBunproSurvey,
    showBunproSurveyModal,
    theme,
  } = useSettingsControllerContext();

  return (
    <>
      {showBunproSurvey && (
        <Modal
          visible={showBunproSurveyModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (isSubmittingBunproSurvey) {
              return;
            }
            setShowBunproSurveyModal(false);
          }}
        >
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.backgroundColor },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  backgroundColor: theme.cardBackground,
                  borderBottomColor: theme.border,
                  paddingTop: modalHeaderPaddingTop,
                },
              ]}
            >
              <TouchableOpacity
                disabled={isSubmittingBunproSurvey}
                onPress={() => setShowBunproSurveyModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    {
                      color: theme.primary,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                    },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                Bunpro Survey
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.bunproSurveyModalContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Super short. This helps prioritize Bunpro support in the app.
              </Text>

              <Text
                style={[
                  styles.bunproSurveyQuestion,
                  { color: theme.textColor, marginTop: 16 },
                ]}
              >
                Do you use Bunpro?
              </Text>

              <View style={styles.bunproSurveyButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.bunproSurveyChoiceButton,
                    {
                      backgroundColor:
                        bunproUsageAnswer === "yes"
                          ? theme.primary
                          : theme.backgroundColor,
                      borderColor:
                        bunproUsageAnswer === "yes"
                          ? theme.primary
                          : theme.border,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                    },
                  ]}
                  disabled={isSubmittingBunproSurvey}
                  onPress={() => {
                    void handleBunproUsageSelection("yes");
                  }}
                >
                  <Text
                    style={[
                      styles.bunproSurveyChoiceButtonText,
                      {
                        color:
                          bunproUsageAnswer === "yes"
                            ? "#FFFFFF"
                            : theme.textColor,
                      },
                    ]}
                  >
                    Yes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bunproSurveyChoiceButton,
                    {
                      backgroundColor:
                        bunproUsageAnswer === "no"
                          ? theme.primary
                          : theme.backgroundColor,
                      borderColor:
                        bunproUsageAnswer === "no"
                          ? theme.primary
                          : theme.border,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                    },
                  ]}
                  disabled={isSubmittingBunproSurvey}
                  onPress={() => {
                    void handleBunproUsageSelection("no");
                  }}
                >
                  <Text
                    style={[
                      styles.bunproSurveyChoiceButtonText,
                      {
                        color:
                          bunproUsageAnswer === "no"
                            ? "#FFFFFF"
                            : theme.textColor,
                      },
                    ]}
                  >
                    No
                  </Text>
                </TouchableOpacity>
              </View>

              {bunproUsageAnswer === "yes" && (
                <View style={styles.bunproSurveyFollowUpContainer}>
                  <Text
                    style={[
                      styles.bunproSurveyQuestion,
                      { color: theme.textColor, marginBottom: 8 },
                    ]}
                  >
                    Would you want Bunpro inside this app too?
                  </Text>

                  <View style={styles.bunproSurveyButtonRow}>
                    <TouchableOpacity
                      style={[
                        styles.bunproSurveyChoiceButton,
                        {
                          backgroundColor:
                            bunproIntegrationAnswer === "yes"
                              ? theme.primary
                              : theme.backgroundColor,
                          borderColor:
                            bunproIntegrationAnswer === "yes"
                              ? theme.primary
                              : theme.border,
                          opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                        },
                      ]}
                      disabled={isSubmittingBunproSurvey}
                      onPress={() => setBunproIntegrationAnswer("yes")}
                    >
                      <Text
                        style={[
                          styles.bunproSurveyChoiceButtonText,
                          {
                            color:
                              bunproIntegrationAnswer === "yes"
                                ? "#FFFFFF"
                                : theme.textColor,
                          },
                        ]}
                      >
                        Yes
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.bunproSurveyChoiceButton,
                        {
                          backgroundColor:
                            bunproIntegrationAnswer === "no"
                              ? theme.primary
                              : theme.backgroundColor,
                          borderColor:
                            bunproIntegrationAnswer === "no"
                              ? theme.primary
                              : theme.border,
                          opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                        },
                      ]}
                      disabled={isSubmittingBunproSurvey}
                      onPress={() => setBunproIntegrationAnswer("no")}
                    >
                      <Text
                        style={[
                          styles.bunproSurveyChoiceButtonText,
                          {
                            color:
                              bunproIntegrationAnswer === "no"
                                ? "#FFFFFF"
                                : theme.textColor,
                          },
                        ]}
                      >
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    value={bunproFeatureRequestInput}
                    onChangeText={setBunproFeatureRequestInput}
                    editable={!isSubmittingBunproSurvey}
                    multiline
                    numberOfLines={3}
                    placeholder="Optional: What Bunpro features would you like here?"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.bunproSurveyInput,
                      {
                        color: theme.textColor,
                        borderColor: theme.border,
                        backgroundColor: theme.backgroundColor,
                      },
                    ]}
                  />

                  <TouchableOpacity
                    style={[
                      styles.bunproSurveySubmitButton,
                      {
                        backgroundColor: theme.primary,
                        opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                      },
                    ]}
                    disabled={isSubmittingBunproSurvey}
                    onPress={() => {
                      void handleSubmitBunproSurvey();
                    }}
                  >
                    <Text style={styles.bunproSurveySubmitButtonText}>
                      {isSubmittingBunproSurvey ? "Saving..." : "Submit"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {bunproUsageAnswer === "no" && (
                <TouchableOpacity
                  style={[
                    styles.bunproSurveySubmitButton,
                    {
                      backgroundColor: theme.primary,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                      marginTop: 14,
                    },
                  ]}
                  disabled={isSubmittingBunproSurvey}
                  onPress={() => {
                    void handleSubmitBunproSurvey();
                  }}
                >
                  <Text style={styles.bunproSurveySubmitButtonText}>
                    {isSubmittingBunproSurvey ? "Saving..." : "Submit"}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  );
}
