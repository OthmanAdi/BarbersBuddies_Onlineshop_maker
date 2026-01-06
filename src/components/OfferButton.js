import {useEffect} from "react";

interface OfferButtonConfig {
    companyName: string;
    description: string;
    siteURL: string;
    companyId: string;
    position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

const OfferButton = () => {
    const config: OfferButtonConfig = {
        companyName: "BarbersBuddies",
        description: "Groundbreaking Solution to an Existing problem in the Hair wellness business world",
        siteURL: "https://offerbutton.com",
        companyId: "98f6e8ce-5617-48c2-a93b-f8faf956fabe",
        position: "bottom-right",
    };

    const positions = {
        "top-left": "top: 12px; left: 12px;",
        "top-center": "top: 12px; left: 50%; transform: translateX(-50%);",
        "top-right": "top: 12px; right: 12px;",
        "bottom-left": "bottom: 12px; left: 12px;",
        "bottom-center": "bottom: 12px; left: 50%; transform: translateX(-50%);",
        "bottom-right": "bottom: 12px; right: 12px;",
    };

    useEffect(() => {
        // Create and append style element
        const styleElement = document.createElement("style");
        styleElement.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500;600;700&display=swap');

      .offer-button-container {
        position: relative;
        overflow: hidden;
      }
      .offer-button {
        background: linear-gradient(180deg, #EBEBEB, #D2D2D2);
        color: #000;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 11px;
        cursor: pointer;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
        box-shadow: 0 2px 1px rgba(248,248,248,.55) inset,
                    0 -6px 2.3px rgba(255,255,255,.25) inset,
                    0 -4px 1px rgba(174,174,174,1) inset;
        font-family: 'IBM Plex Sans', sans-serif;
        transition: background .3s ease;
        position: relative;
        z-index: 1;
      }
      .offer-button:hover { background: linear-gradient(180deg, #E3E3E3, #CDCDCD); }
      .offer-button:active { background: linear-gradient(180deg, #D8D8D8, #C5C5C5); }
      .emoji {
        position: absolute;
        font-size: 36px;
        transition: transform 0.3s;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 0;
        opacity: 0;
      }
      .small { font-size: 24px !important; }
      .smaller { font-size: 12px !important; }
      .tiny { font-size: 6px !important; }
      .offer-button:hover ~ .emoji { opacity: 1 !important; }
      .offer-button:hover ~ .emoji:nth-child(2) { transform: translate(-120px, -42px) rotate(30deg); }
      .offer-button:hover ~ .emoji:nth-child(3) { transform: translate(-108px, 0px) rotate(-30deg); }
      .offer-button:hover ~ .emoji:nth-child(4) { transform: translate(84px, -42px) rotate(30deg); }
      .offer-button:hover ~ .emoji:nth-child(5) { transform: translate(84px, 0px); }
      .offer-button:hover ~ .emoji:nth-child(6) { transform: translate(-120px, 0px); }
      .offer-button:hover ~ .emoji:nth-child(7) { transform: translate(110px, 10px); }
    `;
        document.head.appendChild(styleElement);

        // Create and append container element
        const container = document.createElement("div");
        container.style.cssText = `position: fixed; z-index: 9999; ${positions[config.position]}`;

        container.innerHTML = `
      <div style="text-align: center; background: white; border-radius: 16px; box-shadow: 0 12px 30px rgba(0,0,0,.25), 0 3px 4px rgba(0,0,0,.05); width: 285px; position: relative; font-family: 'IBM Plex Sans', sans-serif; overflow: hidden">
        <button style="position: absolute; top: 16px; right: 16px; background: #f1f1f1; border: none; height: 24px; width: 24px; border-radius: 50%; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="this.parentElement.parentElement.style.display='none'">×</button>
        <div style="padding: 30px 24px 0; border-bottom: 1px solid #CECECD">
          <h1 style="color: #000; font-size: 22px; margin: 0 0 12px; font-weight: 600; line-height: 28.6px; letter-spacing: -.03em;">${config.companyName}</h1>
          <div style="color: #7E7E7E; font-size: 14px; margin-bottom: 24px; line-height: 19.6px; letter-spacing: -.01em; font-weight: 500; margin-top: 11px;">${config.description}</div>
        </div>
        <div style="background-color: #EAE8E4; padding: 21px; position: relative;" class="offer-button-container">
          <button class="offer-button" onclick="window.location.href='${config.siteURL}/company/${config.companyId}/offer'">
            <span style="background: #0066ff; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 8px">$</span>
            Make an offer
          </button>
          <span class="emoji">🤝</span>
          <span class="emoji small">🍀</span>
          <span class="emoji">💰</span>
          <span class="emoji smaller">🔵</span>
          <span class="emoji tiny">🟢</span>
          <span class="emoji tiny">🟢</span>
        </div>
      </div>
    `;

        document.body.appendChild(container);

        // Cleanup function
        const cleanup = () => {
            container.remove();
        };

        // Event listeners for cleanup
        window.addEventListener("nextjs-route-change", cleanup);
        window.addEventListener("beforeunload", cleanup);
        window.addEventListener("popstate", cleanup);

        return () => {
            window.removeEventListener("nextjs-route-change", cleanup);
            window.removeEventListener("beforeunload", cleanup);
            window.removeEventListener("popstate", cleanup);
            styleElement.remove();
            cleanup();
        };
    }, []);

    return null;
};

export default OfferButton;