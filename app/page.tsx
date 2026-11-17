"use client";

import { AccessGate } from "@/components/AccessGate";
import { ProductHome } from "@/components/ProductHome";
import { useGateSession } from "@/hooks/useGateSession";
import { clearAllChoureiData } from "@/lib/cards";

// The Shokuba Connect home (route /). One shared gate serves both
// products: until the operator passes it, this page renders the
// gate (which itself opens with the Shokuba landing for visitors
// without a stored key). After the gate, the operator picks a
// product on ProductHome; each product lives on its own route
// (/chourei, /mendan) under the same session.
export default function ShokubaHomePage() {
  const session = useGateSession();

  // Until the stored consent has been read, render nothing:
  // flashing the gate at an already-verified operator would be
  // confusing.
  if (!session.ready) {
    return <div className="flex flex-1 flex-col" />;
  }

  if (!session.ack) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AccessGate
          initialError={session.gateError}
          onVerified={session.handleVerified}
        />
      </div>
    );
  }

  // Ending the session from the home wipes the same things the
  // workspace's delete-session wipes (see the /chourei page):
  // the server cookie, every stored card and draft, and the
  // consent record.
  const handleDeleteSession = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // The local wipe below still applies.
    }
    clearAllChoureiData(window.sessionStorage);
    clearAllChoureiData(window.localStorage);
    session.clear();
  };

  return (
    <ProductHome
      onDeleteSession={handleDeleteSession}
      sessionWarning={session.sessionWarning}
    />
  );
}
