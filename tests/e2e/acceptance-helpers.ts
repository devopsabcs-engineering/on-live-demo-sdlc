import { expect, type Page, type TestInfo } from "@playwright/test";

export async function tabTo(page: Page, selector: string) {
  const visited: string[] = [];
  for (let index = 0; index < 90; index++) {
    await page.keyboard.press("Tab");
    visited.push(
      await page.evaluate(
        () =>
          document.activeElement?.id ||
          document.activeElement?.tagName ||
          "none",
      ),
    );
    if (
      await page
        .locator(selector)
        .evaluate((element) => element === document.activeElement)
    ) {
      await expect(page.locator(selector)).toBeFocused();
      return visited;
    }
  }
  throw new Error(
    `Keyboard could not reach ${selector}: ${visited.join(" -> ")}`,
  );
}

export async function inspectRendered(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const inspection = await page.evaluate(() => {
    const root = document.querySelector("dialog[open]") ?? document.body;
    const issues: string[] = [];
    const contrast: { text: string; ratio: number; minimum: number }[] = [];
    const fragments: { text: string; rect: DOMRect }[] = [];
    function visible(element: Element) {
      const style = getComputedStyle(element);
      return (
        element.getClientRects().length > 0 &&
        style.visibility !== "hidden" &&
        !element.closest(
          "[hidden], script, style, option, textarea, .skip-link:not(:focus)",
        )
      );
    }
    function rgba(value: string) {
      const parts = value.match(/[\d.]+/gu)?.map(Number) ?? [];
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    }
    function background(element: Element | null): number[] {
      if (!element) return [255, 255, 255];
      const color = rgba(getComputedStyle(element).backgroundColor);
      const behind =
        color[3] === 1 ? [0, 0, 0] : background(element.parentElement);
      return color
        .slice(0, 3)
        .map(
          (channel, index) =>
            channel * color[3]! + behind[index]! * (1 - color[3]!),
        );
    }
    function luminance(color: number[]) {
      const linear = color.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
    }
    function ratio(first: number[], second: number[]) {
      const values = [luminance(first), luminance(second)];
      return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      const text = node.textContent?.trim();
      if (!parent || !text || !visible(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const style = getComputedStyle(parent);
      const size = Number.parseFloat(style.fontSize);
      const minimum =
        size >= 24 ||
        (size >= 18.66 && Number.parseInt(style.fontWeight) >= 700)
          ? 3
          : 4.5;
      if (!parent.closest(":disabled")) {
        const measured = ratio(rgba(style.color), background(parent));
        contrast.push({ text: text.slice(0, 80), ratio: measured, minimum });
        if (measured < minimum)
          issues.push(
            `contrast ${measured.toFixed(2)} < ${minimum}: ${text.slice(0, 80)}`,
          );
      }
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        fragments.push({ text: text.slice(0, 80), rect });
        if (rect.left < -1 || rect.right > innerWidth + 1)
          issues.push(`viewport text clipping: ${text.slice(0, 80)}`);
        for (
          let ancestor: Element | null = parent;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const ancestorStyle = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          if (
            ["hidden", "clip", "auto", "scroll"].includes(
              ancestorStyle.overflowX,
            ) &&
            (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
          )
            issues.push(`horizontal ancestor clipping: ${text.slice(0, 80)}`);
          if (
            ["hidden", "clip"].includes(ancestorStyle.overflowY) &&
            (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)
          )
            issues.push(`vertical ancestor clipping: ${text.slice(0, 80)}`);
        }
      }
    }
    for (const [index, first] of fragments.entries()) {
      for (const second of fragments.slice(index + 1)) {
        const width =
          Math.min(first.rect.right, second.rect.right) -
          Math.max(first.rect.left, second.rect.left);
        const height =
          Math.min(first.rect.bottom, second.rect.bottom) -
          Math.max(first.rect.top, second.rect.top);
        if (width > 2 && height > 2)
          issues.push(`text overlap: ${first.text} / ${second.text}`);
      }
    }
    const controls = [
      ...root.querySelectorAll("button, input, select, textarea, a[href]"),
    ].filter(visible);
    for (const element of controls) {
      const bounds = element.getBoundingClientRect();
      if (bounds.left < -1 || bounds.right > innerWidth + 1)
        issues.push(
          `control outside viewport: ${element.id || element.textContent}`,
        );
      if (element instanceof HTMLSelectElement) {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const available =
          element.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Math.max(20, Number.parseFloat(style.paddingRight));
        if (
          context.measureText(element.selectedOptions[0]?.text || "").width >
          available + 1
        )
          issues.push(`selected option clipping: ${element.id}`);
      }
    }
    const focused = document.activeElement;
    let focus = null;
    if (
      focused &&
      root.contains(focused) &&
      focused.matches(":focus-visible")
    ) {
      const style = getComputedStyle(focused);
      const bounds = focused.getBoundingClientRect();
      const thickness = Number.parseFloat(style.outlineWidth);
      const offset = Number.parseFloat(style.outlineOffset);
      const contrastRatio = ratio(
        rgba(style.outlineColor),
        background(focused.parentElement),
      );
      focus = {
        id: focused.id,
        thickness,
        offset,
        contrastRatio,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
      };
      if (style.outlineStyle === "none" || thickness < 2 || contrastRatio < 3)
        issues.push(`focus indicator insufficient: ${focused.id}`);
      const outside = Math.max(0, thickness + offset);
      if (
        bounds.left - outside < 0 ||
        bounds.right + outside > innerWidth ||
        bounds.top - outside < 0 ||
        bounds.bottom + outside > innerHeight
      )
        issues.push(`focus clipped by viewport: ${focused.id}`);
      const hit = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      );
      if (hit && !focused.contains(hit))
        issues.push(`focus occluded: ${focused.id}`);
    }
    return {
      issues: [...new Set(issues)],
      contrast,
      focus,
      textFragments: fragments.length,
      controls: controls.length,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      language: document.documentElement.lang,
      theme: document.documentElement.dataset.theme,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  await testInfo.attach(`${name}-rendered-inspection`, {
    body: JSON.stringify(inspection, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
  expect(inspection.textFragments).toBeGreaterThan(0);
  expect(inspection.horizontalOverflow).toBe(false);
  expect(inspection.issues, JSON.stringify(inspection, null, 2)).toEqual([]);
  return inspection;
}
