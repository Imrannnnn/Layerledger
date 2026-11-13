global.IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { FreePackPage } from "./FreePackPage";

describe("FreePackPage Landing Page Tests", () => {
  let container, root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => { root.unmount(); });
      root = null;
    }
    document.body.removeChild(container);
    container = null;
  });

  it("renders brand name, main heading, and lede description", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<FreePackPage />);
    });

    expect(container.textContent).toContain("BAKEWEALTH");
    expect(container.textContent).toContain("International");
    expect(container.textContent).toContain("Your free pack is ready");
    expect(container.textContent).toContain("Two tools for Nigerian bakers, in one file.");
  });

  it("renders both items in the pack with correct descriptions", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<FreePackPage />);
    });

    expect(container.textContent).toContain("The Psychology of a Baker");
    expect(container.textContent).toContain("Ten questions about the money side of your cakes");
    expect(container.textContent).toContain("The Cake Covering Chart");
    expect(container.textContent).toContain("How many grams of buttercream, fondant or whipped cream");
  });

  it("renders downloadable button pointing to the PDF with download attribute", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<FreePackPage />);
    });

    const downloadBtn = container.querySelector("a.free-pack-btn");
    expect(downloadBtn).not.toBeNull();
    expect(downloadBtn.getAttribute("href")).toBe("/the-bakers-free-pack.pdf");
    expect(downloadBtn.hasAttribute("download")).toBe(true);
    expect(downloadBtn.textContent).toContain("Download the pack");
    expect(downloadBtn.textContent).toContain("PDF · 7 pages · free");
  });

  it("renders next section and external link to Selar cake costing system", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<FreePackPage />);
    });

    expect(container.textContent).toContain("Now, what does your cake cost you?");
    const costingLink = container.querySelector('a[href="https://selar.com/cakecostingsystem"]');
    expect(costingLink).not.toBeNull();
    expect(costingLink.textContent).toContain("See the Cake Costing System");
  });
});
