global.IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { HelpAssistantModal, HELP_TOPICS, BAKERY_GLOSSARY } from "./HelpAssistantModal.jsx";

describe("HelpAssistantModal AI Assistant & Walkthrough Tests", () => {
  let container, root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  it("1. Does not render when isOpen is false", () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={false}
          onClose={() => {}}
          initialTopic="calibration"
        />
      );
    });

    expect(container.innerHTML).toBe("");
  });

  it("2. Renders cleanly when isOpen is true with initial topic", () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={() => {}}
          initialTopic="calibration"
          company={{ name: "Sugar & Spice" }}
        />
      );
    });

    expect(container.textContent).toContain("BakeWealth AI Assistant & Kitchen Guide");
    expect(container.textContent).toContain("Recipe Calibration");
    expect(container.textContent).toContain("Step-by-Step Kitchen & System Setup");
    expect(container.textContent).toContain("Bake One Reference Pan");
  });

  it("3. Displays all help topics including Bakery Terms & Glossary in the navigation sidebar", () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={() => {}}
          initialTopic="calibration"
        />
      );
    });

    HELP_TOPICS.forEach(topic => {
      expect(container.textContent).toContain(topic.title);
    });
    expect(HELP_TOPICS.some(t => t.id === "glossary")).toBe(true);
  });

  it("4. Switches topic when a sidebar topic button is clicked", () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={() => {}}
          initialTopic="calibration"
        />
      );
    });

    // Find the Order Calculator button in the sidebar
    const calcButton = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Order Calculator") && !btn.textContent.includes("❓")
    );
    expect(calcButton).toBeTruthy();

    act(() => {
      calcButton.click();
    });

    // Verify calculator knowledge is rendered
    expect(container.textContent).toContain("Order Calculator — Multi-Tier Geometries, Portions & Margins");
    expect(container.textContent).toContain("Choose Cake Item & Stacking");
  });

  it("5. Switches between Step-by-Step Guide and Ask AI Anything tabs", () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={() => {}}
          initialTopic="calibration"
        />
      );
    });

    // Find tab button for "Ask AI Anything"
    const aiTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Ask AI Anything")
    );
    expect(aiTabBtn).toBeTruthy();

    act(() => {
      aiTabBtn.click();
    });

    const input = container.querySelector("input");
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain("Ask anything about");
  });

  it("6. Submitting a question returns an instant domain response", async () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={() => {}}
          initialTopic="calibration"
        />
      );
    });

    // Switch to AI tab
    const aiTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Ask AI Anything")
    );
    act(() => {
      aiTabBtn.click();
    });

    // Find an FAQ chip button in the chat view
    const allButtons = Array.from(container.querySelectorAll("button"));
    const faqChip = allButtons.find(b => b.textContent.includes("How do I calibrate my vanilla sponge?"));
    expect(faqChip).toBeTruthy();

    act(() => {
      faqChip.click();
    });

    // Wait for the local instant knowledge engine timeout (350ms)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 450));
    });

    // Chat messages should contain the user prompt and the AI reply
    expect(container.textContent).toContain("How do I calibrate my vanilla sponge?");
    expect(container.textContent).toContain("10.91 g/in³");
  });

  it("7. Calling onClose when close button is clicked", () => {
    const handleClose = jest.fn();

    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={handleClose}
          initialTopic="calibration"
        />
      );
    });

    const closeBtn = container.querySelector("button[title='Close Guide']");
    expect(closeBtn).toBeTruthy();

    act(() => {
      closeBtn.click();
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("8. Explains 'calibrated' terminology in plain English with kitchen analogy", async () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={() => {}}
          initialTopic="calibration"
        />
      );
    });

    // Switch to AI tab
    const aiTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Ask AI Anything")
    );
    act(() => {
      aiTabBtn.click();
    });

    // Find the Terminology chip for 'What does "Calibrated" mean?'
    const allButtons = Array.from(container.querySelectorAll("button"));
    const termChip = allButtons.find(b => b.textContent.includes('What does "Calibrated" mean?'));
    expect(termChip).toBeTruthy();

    act(() => {
      termChip.click();
    });

    // Wait for local instant reply
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 450));
    });

    expect(container.textContent).toContain('What Does "Calibrated / Calibration Bake" Mean in BakeWealth?');
    expect(container.textContent).toContain("In Plain English:");
    expect(container.textContent).toContain("Kitchen Analogy:");
    expect(container.textContent).toContain("Where to Find / Set It in BakeWealth:");
  });

  it("9. Renders the interactive Bakery Terms & Glossary browser", () => {
    act(() => {
      root.render(
        <HelpAssistantModal
          isOpen={true}
          onClose={() => {}}
          initialTopic="glossary"
        />
      );
    });

    expect(container.textContent).toContain("Bakery Terms & Plain-English Glossary");
    expect(container.textContent).toContain("Calibrated / Calibration Bake");
    expect(container.textContent).toContain("Batter Density (g/in³ or g/cm³)");
    expect(container.textContent).toContain("Levelled Height");
    expect(container.textContent).toContain("Trim % (Trim Margin)");

    const searchInput = container.querySelector("input[placeholder*='Search terms']");
    expect(searchInput).toBeTruthy();
  });
});
