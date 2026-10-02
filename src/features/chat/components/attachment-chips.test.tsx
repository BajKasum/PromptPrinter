import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentTray, MessageAttachments } from "./attachment-chips";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import type { AttachmentView } from "@/shared/lib/chat-attachments";

const draftImage: DraftAttachment = {
  id: "i1",
  name: "screen.png",
  kind: "image",
  mediaType: "image/png",
  sizeBytes: 120_000,
  data: "QUJD",
  previewUrl: "data:image/png;base64,QUJD",
};
const draftText: DraftAttachment = {
  id: "t1",
  name: "notes.md",
  kind: "text",
  mediaType: "text/plain",
  sizeBytes: 2048,
  data: "QUJD",
};

describe("AttachmentTray", () => {
  it("renders nothing without attachments", () => {
    const { container } = render(<AttachmentTray items={[]} pending={0} onRemove={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an image as a preview with its name as alt text", () => {
    render(<AttachmentTray items={[draftImage]} pending={0} onRemove={() => {}} />);
    const img = screen.getByRole("img", { name: "screen.png" });
    expect(img).toHaveAttribute("src", "data:image/png;base64,QUJD");
  });

  it("shows a text file as a chip with name and size", () => {
    render(<AttachmentTray items={[draftText]} pending={0} onRemove={() => {}} />);
    expect(screen.getByText("notes.md")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("is a labelled list, one item per attachment", () => {
    render(<AttachmentTray items={[draftImage, draftText]} pending={0} onRemove={() => {}} />);
    const list = screen.getByRole("list", { name: "Anhänge" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("removes exactly the attachment whose button was pressed", async () => {
    const onRemove = vi.fn();
    render(<AttachmentTray items={[draftImage, draftText]} pending={0} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: "„notes.md“ entfernen" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("t1");
  });

  it("shows a placeholder for every file still being prepared", () => {
    render(<AttachmentTray items={[draftText]} pending={2} onRemove={() => {}} />);
    expect(screen.getAllByRole("status", { name: "Wird vorbereitet…" })).toHaveLength(2);
  });

  it("shows the placeholders even before the first file is ready", () => {
    render(<AttachmentTray items={[]} pending={1} onRemove={() => {}} />);
    expect(screen.getByRole("status", { name: "Wird vorbereitet…" })).toBeInTheDocument();
  });
});

describe("MessageAttachments", () => {
  const image: AttachmentView = {
    id: "a1",
    name: "entwurf.png",
    kind: "image",
    mediaType: "image/png",
    sizeBytes: 5000,
    url: "https://signed.test/a1",
  };

  it("renders nothing without attachments", () => {
    const { container } = render(<MessageAttachments attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links an image to its full size, opening in a new tab without leaking the opener", () => {
    render(<MessageAttachments attachments={[image]} />);
    const link = screen.getByRole("link", { name: "„entwurf.png“ in voller Größe öffnen" });
    expect(link).toHaveAttribute("href", "https://signed.test/a1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(within(link).getByRole("img", { name: "entwurf.png" })).toHaveAttribute(
      "src",
      "https://signed.test/a1"
    );
  });

  // Ohne Adresse (die Vorschau liess sich nicht erzeugen) bleibt der Name.
  it("falls back to a chip when an image has no url", () => {
    render(<MessageAttachments attachments={[{ ...image, url: undefined }]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("entwurf.png")).toBeInTheDocument();
  });

  it("shows a text file as a chip, not a link", () => {
    render(
      <MessageAttachments
        attachments={[
          { id: "t1", name: "notes.md", kind: "text", mediaType: "text/plain", sizeBytes: 3000 },
        ]}
      />
    );
    expect(screen.getByText("notes.md")).toBeInTheDocument();
    expect(screen.getByText("3 KB")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
