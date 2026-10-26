// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProductGallery } from "./product-gallery";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

const thumbs = [1, 2, 3].map((id) => ({ id, url: `/full/${id}.jpg`, thumbUrl: `/thumb/${id}.jpg` }));

/**
 * GOL-3583: the thumbnail <button>s carried role="listitem", which strips the
 * button role and makes aria-pressed invalid (axe aria-allowed-attr / list).
 * The strip is a real list of real buttons, each with a distinct name.
 */
describe("<ProductGallery /> thumbnail strip", () => {
  afterEach(cleanup);

  it("is a list of named toggle buttons, one per image", () => {
    const onPick = vi.fn();
    render(<ProductGallery name="Pawpaw" featured={false} hero="/full/1.jpg" thumbs={thumbs} activeUrl="/full/2.jpg" onPick={onPick} />);
    const list = screen.getByRole("list", { name: "Product images" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    const buttons = items.map((li) => within(li).getByRole("button"));
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Show image 1 of 3",
      "Show image 2 of 3",
      "Show image 3 of 3",
    ]);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    expect(buttons.every((b) => !b.hasAttribute("role"))).toBe(true);
    fireEvent.click(buttons[2]);
    expect(onPick).toHaveBeenCalledWith("/full/3.jpg");
  });
});
