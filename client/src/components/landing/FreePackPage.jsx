import React, { useEffect } from "react";

export function FreePackPage() {
  useEffect(() => {
    document.title = "Your Free Baker's Pack | BakeWealth International";
  }, []);

  return (
    <div className="free-pack-body">
      <style>{`
        /* Scoped styling to ensure brand integrity */
        :root {
          --fp-page: #FBF7F1;
          --fp-card: #FFFFFF;
          --fp-brown: #3E1C00;
          --fp-brown-2: #55290A;
          --fp-gold: #9A6B14;
          --fp-gold-br: #C9952A;
          --fp-cream: #FAE9C8;
          --fp-ink: #241206;
          --fp-ink-soft: #6B5B4C;
          --fp-rule: #E3D8C8;
          --fp-display: "Fraunces", Georgia, serif;
          --fp-body: "Karla", system-ui, sans-serif;
          color-scheme: light;
        }

        .free-pack-body {
          min-height: 100vh;
          width: 100%;
          background: var(--fp-page);
          color: var(--fp-ink);
          font-family: var(--fp-body);
          font-size: 16px;
          line-height: 1.55;
          margin: 0;
          padding: 0;
          -webkit-text-size-adjust: 100%;
          box-sizing: border-box;
        }

        .free-pack-wrap {
          max-width: 520px;
          margin: 0 auto;
          padding: 30px 16px 56px;
          box-sizing: border-box;
        }

        .free-pack-brand {
          text-align: center;
          margin-bottom: 26px;
        }

        .free-pack-brand .name {
          font-family: var(--fp-display);
          font-weight: 700;
          font-size: 21px;
          letter-spacing: .14em;
          color: var(--fp-brown);
        }

        .free-pack-brand .sub {
          font-size: 10.5px;
          letter-spacing: .34em;
          text-transform: uppercase;
          color: var(--fp-gold-br);
          font-weight: 700;
          margin-top: 6px;
        }

        .free-pack-h1 {
          font-family: var(--fp-display);
          font-weight: 700;
          font-size: clamp(30px, 8vw, 40px);
          line-height: 1.07;
          color: var(--fp-brown);
          margin: 0 0 12px;
          text-align: center;
          text-wrap: balance;
        }

        .free-pack-lede {
          text-align: center;
          color: var(--fp-ink-soft);
          font-size: 16.5px;
          margin: 0 auto 24px;
          max-width: 38ch;
        }

        /* the pack */
        .free-pack-card {
          background: var(--fp-card);
          border: 1px solid var(--fp-rule);
          border-radius: 16px;
          padding: 20px 18px;
          margin: 0 0 22px;
          box-shadow: 0 4px 12px rgba(62, 28, 0, 0.04);
        }

        .free-pack-card h2 {
          font-family: var(--fp-body);
          font-size: 11.5px;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: var(--fp-gold-br);
          font-weight: 700;
          margin: 0 0 14px;
        }

        .free-pack-item {
          display: flex;
          gap: 13px;
          align-items: flex-start;
          padding: 11px 0;
          border-bottom: 1px solid var(--fp-rule);
        }

        .free-pack-item:last-child {
          border-bottom: none;
          padding-bottom: 2px;
        }

        .free-pack-item .num {
          flex: 0 0 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--fp-brown);
          color: var(--fp-cream);
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          margin-top: 2px;
        }

        .free-pack-item .tx strong {
          display: block;
          font-size: 16px;
          color: var(--fp-brown);
          font-weight: 700;
        }

        .free-pack-item .tx span {
          font-size: 14.5px;
          color: var(--fp-ink-soft);
          line-height: 1.45;
        }

        /* the button */
        .free-pack-cta {
          text-align: center;
          margin: 0 0 10px;
        }

        .free-pack-btn {
          display: block;
          width: 100%;
          background: var(--fp-brown);
          color: #FBF7F1 !important;
          text-decoration: none;
          font-family: var(--fp-body);
          font-weight: 700;
          font-size: 18px;
          padding: 19px 20px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 24px -12px rgba(62, 28, 0, .6);
          box-sizing: border-box;
          transition: background-color 0.15s ease, transform 0.1s ease;
        }

        .free-pack-btn:hover {
          background: var(--fp-brown-2);
          color: #FFFFFF !important;
        }

        .free-pack-btn:active {
          transform: scale(0.99);
        }

        .free-pack-btn:focus-visible {
          outline: 3px solid var(--fp-gold-br);
          outline-offset: 3px;
        }

        .free-pack-btn .small {
          display: block;
          font-weight: 400;
          font-size: 13px;
          color: #E2C9A4;
          margin-top: 4px;
        }

        .free-pack-noemail {
          font-size: 13.5px;
          color: var(--fp-ink-soft);
          margin: 12px 0 0;
          line-height: 1.45;
        }

        .free-pack-hr {
          border: none;
          border-top: 1px solid var(--fp-rule);
          margin: 30px 0 24px;
        }

        .free-pack-next {
          background: var(--fp-cream);
          border: 1px solid var(--fp-gold-br);
          border-radius: 16px;
          padding: 19px 18px;
        }

        .free-pack-next h3 {
          font-family: var(--fp-display);
          font-size: 19px;
          font-weight: 700;
          color: var(--fp-brown);
          margin: 0 0 7px;
        }

        .free-pack-next p {
          font-size: 14.8px;
          color: var(--fp-ink);
          margin: 0 0 14px;
          line-height: 1.5;
        }

        .free-pack-next a {
          display: inline-block;
          background: var(--fp-gold);
          color: #fff !important;
          text-decoration: none;
          font-weight: 700;
          font-size: 15px;
          padding: 12px 20px;
          border-radius: 10px;
          transition: opacity 0.15s ease;
        }

        .free-pack-next a:hover {
          opacity: 0.92;
        }

        .free-pack-next a:focus-visible {
          outline: 3px solid var(--fp-brown);
          outline-offset: 2px;
        }

        .free-pack-more {
          text-align: center;
          margin-top: 22px;
          font-size: 14.5px;
          color: var(--fp-ink-soft);
        }

        .free-pack-more a {
          color: var(--fp-gold);
          font-weight: 700;
          text-decoration: none;
        }

        .free-pack-more a:hover {
          text-decoration: underline;
        }

        .free-pack-footer {
          margin-top: 34px;
          padding-top: 20px;
          border-top: 1px solid var(--fp-rule);
          text-align: center;
          font-size: 13px;
          color: var(--fp-ink-soft);
          line-height: 1.7;
        }
      `}</style>

      <div className="free-pack-wrap">
        <div className="free-pack-brand">
          <div className="name">BAKEWEALTH</div>
          <div className="sub">International</div>
        </div>

        <h1 className="free-pack-h1">Your free pack is ready</h1>
        <p className="free-pack-lede">Two tools for Nigerian bakers, in one file. Tap below and it is yours.</p>

        <div className="free-pack-card">
          <h2>What is inside</h2>
          <div className="free-pack-item">
            <div className="num">1</div>
            <div className="tx">
              <strong>The Psychology of a Baker</strong>
              <span>Ten questions about the money side of your cakes, and what each answer is costing you. Most bakers score three.</span>
            </div>
          </div>
          <div className="free-pack-item">
            <div className="num">2</div>
            <div className="tx">
              <strong>The Cake Covering Chart</strong>
              <span>How many grams of buttercream, fondant or whipped cream it takes to fill and cover any tier from 4 to 14 inches, round or square.</span>
            </div>
          </div>
        </div>

        <div className="free-pack-cta">
          <a
            className="free-pack-btn"
            href="/the-bakers-free-pack.pdf"
            download="The_Psychology_of_a_Baker_Complete_Free_Pack.pdf"
          >
            Download the pack
            <span className="small">PDF &middot; 7 pages &middot; free</span>
          </a>
          <p className="free-pack-noemail">No email needed. It is yours to keep and to pass on to any baker who needs it.</p>
        </div>

        <hr className="free-pack-hr" />

        <div className="free-pack-next">
          <h3>Now, what does your cake cost you?</h3>
          <p>
            The chart gives you the grams. It cannot tell you what you paid for butter this month, what an hour in your kitchen is worth, or which of your cakes actually makes money. The Complete Cake Costing System works all of that out from your own prices and your own recipes, for any cake, in about a minute.
          </p>
          <a href="https://selar.com/cakecostingsystem" target="_blank" rel="noopener noreferrer">
            See the Cake Costing System
          </a>
        </div>

        <p className="free-pack-more">
          More free tools for bakers:{" "}
          <a href="https://bakewealthinternational.com/#toolkit" target="_blank" rel="noopener noreferrer">
            the Baker's Toolkit
          </a>
        </p>

        <footer className="free-pack-footer">
          &copy; BakeWealth International
        </footer>
      </div>
    </div>
  );
}

export default FreePackPage;
