import { isPortegoUsername } from "../../utils/portegoAccess";

export function canUseYouGlish(username: string | null | undefined, enabled: boolean | undefined) {
  return enabled === true && isPortegoUsername(username);
}

export function youGlishSearchUrl(query: string) {
  return `https://youglish.com/pronounce/${encodeURIComponent(query.trim())}/japanese`;
}

export const YOUGLISH_MESSAGE = "kakehashi-youglish";

export type YouGlishMessage = {
  channel: typeof YOUGLISH_MESSAGE;
  type: "results" | "error" | "height" | "playing";
  value?: number;
};

export function readYouGlishMessage(value: unknown): YouGlishMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.channel !== YOUGLISH_MESSAGE) return null;
  if (message.type === "error" || message.type === "playing") return { channel: YOUGLISH_MESSAGE, type: message.type };
  if ((message.type === "results" || message.type === "height") && typeof message.value === "number" && Number.isFinite(message.value) && message.value >= 0) {
    return { channel: YOUGLISH_MESSAGE, type: message.type, value: message.value };
  }
  return null;
}

// The official widget runs in a separate document, never in the app's React tree.
// JSON escaping prevents a selected word from becoming executable HTML.
export function youGlishPlayerDocument(query: string, dark: boolean) {
  const config = JSON.stringify({ query: query.trim(), dark, channel: YOUGLISH_MESSAGE }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;padding:0}body{background:${dark ? "#111216" : "#ffffff"}}#player{width:100%}iframe{max-width:100%;border:0}</style>
</head><body><div id="player"></div><script>
(function(){
  var config=${config};
  function send(type,value){
    var message={channel:config.channel,type:type,value:value};
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else window.parent.postMessage(message,"*");
  }
  function resize(){send("height",Math.ceil(document.getElementById("player").getBoundingClientRect().height));}
  window.onYouglishAPIReady=function(){
    try {
      var widget=new YG.Widget("player",{
        autoStart:0,
        components:92,
        backgroundColor:config.dark?"#111216":"#ffffff",
        textColor:config.dark?"#f3f3f5":"#222222",
        captionColor:config.dark?"#f3f3f5":"#222222",
        titleColor:config.dark?"#f3f3f5":"#222222",
        events:{
          onFetchDone:function(event){send("results",event.totalResult);resize();},
          onError:function(){send("error");},
          onPlayerStateChange:function(event){if(event.state===1)send("playing");}
        }
      });
      widget.fetch(config.query,"japanese");
      if(window.ResizeObserver)new ResizeObserver(resize).observe(document.getElementById("player"));
    } catch(error){send("error");}
  };
  var script=document.createElement("script");
  script.src="https://youglish.com/public/emb/widget.js";
  script.onerror=function(){send("error");};
  document.head.appendChild(script);
})();
</script></body></html>`;
}
