/** sherpa-onnx 1.13.8's serial WASM is browser compatible; its Node FS shim is not. */
export function browserSherpaGlue(source: string, pathSource: string) {
  const start =
    'if(ENVIRONMENT_IS_NODE){NODEFS.staticInit()}if(!ENVIRONMENT_IS_NODE){throw new Error("NODERAWFS';
  const end = '{if(Module["noExitRuntime"])';
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  if (
    first < 0 ||
    last < 0 ||
    source.indexOf(start, first + 1) >= 0 ||
    source.split('var nodePath=require("path");').length !== 2
  )
    throw new Error(
      "The pinned speech runtime changed. Browser adaptation must be reviewed.",
    );
  const adapted = (source.slice(0, first) + source.slice(last)).replace(
    'var nodePath=require("path");',
    "var nodePath=__pathModule.exports;",
  );
  return (
    "var __pathModule={exports:{}};(function(module,exports,process){\n" +
    pathSource +
    '\n})(__pathModule,__pathModule.exports,{cwd:()=>"/"});\n' +
    adapted
  );
}
