import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccessGate } from "@/components/AccessGate";
import { ja } from "@/lib/i18n/ja";

// The gate takes the user's OpenRouter
// API key. On mount it probes GET /api/verify — 401 means "no stored
// key, show the paste field", 204 means "a key cookie is stored in
// this browser, offer to continue".
const KEY = "sk-or-v1-testkey0123456789abcdef0123456789abcdef01234567";

function stubFetch(probeStatus: number, postStatus: number) {
  const fetchMock = vi.fn(
    async (_url: unknown, init?: RequestInit) =>
      new Response(null, {
        status: init?.method === "POST" ? postStatus : probeStatus,
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderGate(probeStatus = 401, postStatus = 204) {
  const fetchMock = stubFetch(probeStatus, postStatus);
  const onVerified = vi.fn();
  render(<AccessGate onVerified={onVerified} />);
  // Since the home screen exists, a visitor without a
  // stored key meets the landing first; its start button leads to
  // the gate these tests exercise. Click through when it is shown
  // (with a stored key the gate appears by itself).
  const cta = screen.queryByRole("button", { name: ja.homeStartButton });
  if (cta) {
    fireEvent.click(cta);
  }
  return { fetchMock, onVerified };
}

describe("AccessGate — API key gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the home screen first to a visitor without a stored key, and its button opens the gate", async () => {
    stubFetch(401, 204);
    render(<AccessGate onVerified={vi.fn()} />);
    expect(
      await screen.findByRole("heading", { name: ja.shokubaTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(ja.shokubaLead)).toBeInTheDocument();
    // Both products are introduced on the landing.
    expect(screen.getByText(ja.choureiTagline)).toBeInTheDocument();
    expect(screen.getByText(ja.mendanName)).toBeInTheDocument();
    expect(screen.getByText(ja.mendanTagline)).toBeInTheDocument();
    for (const feature of ja.homeFeatures) {
      expect(screen.getByText(feature.title)).toBeInTheDocument();
    }
    // Since the usage steps and the note live on the
    // gate screen, not on the landing.
    for (const step of ja.homeSteps) {
      expect(screen.queryByText(step)).toBeNull();
    }
    expect(screen.queryByText(ja.homeNote)).toBeNull();
    // The key form is not there yet.
    expect(screen.queryByLabelText(ja.apiKeyLabel)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: ja.homeStartButton }),
    );
    expect(
      await screen.findByLabelText(ja.apiKeyLabel),
    ).toBeInTheDocument();
    // The gate carries the steps and the note now.
    for (const step of ja.homeSteps) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    expect(screen.getByText(ja.homeNote)).toBeInTheDocument();
  });

  it("skips the home screen when a key is already stored (returning user)", async () => {
    stubFetch(204, 204);
    render(<AccessGate onVerified={vi.fn()} />);
    expect(await screen.findByText(ja.storedKeyNote)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: ja.homeStartButton }),
    ).toBeNull();
  });

  it("show/hide button toggles the key field between password and text", async () => {
    await renderGate();
    const input = (await screen.findByLabelText(
      ja.apiKeyLabel,
    )) as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: ja.apiKeyShow }));
    expect(input.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: ja.apiKeyHide }));
    expect(input.type).toBe("password");
  });

  it("shows the guide, the OpenRouter key link, and the consent checkbox (warnings live only in the banner)", async () => {
    await renderGate();
    for (const line of ja.gateGuide) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    const link = screen.getByRole("link", { name: ja.getKeyButton });
    expect(link).toHaveAttribute(
      "href",
      "https://openrouter.ai/ja",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText(ja.consentLabel)).toBeInTheDocument();
    // Layout: the key button sits BELOW the start
    // button, separated by または.
    const startButton = screen.getByRole("button", {
      name: ja.startButton,
    });
    expect(screen.getByText(ja.gateOrText)).toBeInTheDocument();
    expect(
      startButton.compareDocumentPosition(link) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps start disabled until consent is ticked and a key is pasted", async () => {
    await renderGate();
    const start = screen.getByRole("button", { name: ja.startButton });
    expect(start).toBeDisabled();

    fireEvent.click(screen.getByLabelText(ja.consentLabel));
    expect(start).toBeDisabled();

    fireEvent.change(await screen.findByLabelText(ja.apiKeyLabel), {
      target: { value: KEY },
    });
    expect(start).toBeEnabled();
  });

  it("sends the pasted key as JSON and calls onVerified after a 204", async () => {
    const { fetchMock, onVerified } = await renderGate();
    fireEvent.click(screen.getByLabelText(ja.consentLabel));
    fireEvent.change(await screen.findByLabelText(ja.apiKeyLabel), {
      target: { value: `  ${KEY}  ` },
    });
    fireEvent.click(screen.getByRole("button", { name: ja.startButton }));

    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledWith(true);
    });
    const post = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(post).toBeDefined();
    // The key is trimmed before it is sent.
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({
      apiKey: KEY,
    });
  });

  it("shows the unauthorized message after a 401 and stays on the gate", async () => {
    const { onVerified } = await renderGate(401, 401);
    fireEvent.click(screen.getByLabelText(ja.consentLabel));
    fireEvent.change(await screen.findByLabelText(ja.apiKeyLabel), {
      target: { value: KEY },
    });
    fireEvent.click(screen.getByRole("button", { name: ja.startButton }));

    expect(
      await screen.findByText(ja.errors.unauthorized),
    ).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("offers to continue with a stored key instead of asking for a paste", async () => {
    const { fetchMock, onVerified } = await renderGate(204, 204);
    expect(await screen.findByText(ja.storedKeyNote)).toBeInTheDocument();
    expect(screen.queryByLabelText(ja.apiKeyLabel)).toBeNull();

    fireEvent.click(screen.getByLabelText(ja.consentLabel));
    fireEvent.click(screen.getByRole("button", { name: ja.startButton }));

    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledWith(false);
    });
    const post = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "POST",
    );
    // Resume sends no key — the cookie speaks for itself.
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({});
  });
});
