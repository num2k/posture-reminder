(()=>{chrome.runtime.onMessage.addListener(a=>{a.type==="play-audio"&&d(a.play)});function d({source:a,volume:i}){let n=new Audio(a);n.volume=i!=null?i:1,n.play()}})();
