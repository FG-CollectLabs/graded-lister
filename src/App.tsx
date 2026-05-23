import { useEffect, useState } from "react";
import { auth, onAuthStateChanged, signInWithGoogle, signOutUser, type User } from "./firebase";
import CertLookup from "./pages/CertLookup";
import ListingBuilder from "./pages/ListingBuilder";
import type { PSACert } from "./lib/psa";

const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL;

type View = "lookup" | "listing";

interface ListingState {
  cert: PSACert;
  frontUrl: string | null;
  backUrl: string | null;
}

export default function App() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [view, setView] = useState<View>("lookup");
  const [listing, setListing] = useState<ListingState | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setAuthError((e as Error).message);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (user === "loading") {
    return (
      <div className="state-container" style={{ height: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  // ── Sign-in gate ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="state-container" style={{ height: "100vh" }}>
        <div className="state-box" style={{ maxWidth: 360 }}>
          <div className="brand-mark" style={{ margin: "0 auto 16px", width: 40, height: 40, fontSize: 16 }}>GL</div>
          <h2 style={{ textAlign: "center", marginBottom: 8 }}>Graded Lister</h2>
          <p style={{ textAlign: "center", color: "var(--text-dim)", marginBottom: 24, fontSize: 13 }}>
            Look up a PSA cert, fetch card images, and generate an eBay listing CSV.
          </p>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleSignIn}>
            Sign in with Google
          </button>
          {authError && (
            <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 12, textAlign: "center" }}>{authError}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Access control ────────────────────────────────────────────────────────────
  if (user.email !== OWNER_EMAIL) {
    return (
      <div className="state-container" style={{ height: "100vh" }}>
        <div className="state-box" style={{ maxWidth: 360 }}>
          <div className="brand-mark" style={{ margin: "0 auto 16px", width: 40, height: 40, fontSize: 16 }}>GL</div>
          <h3>Access Restricted</h3>
          <p>This tool is private. Signed in as <strong>{user.email}</strong>.</p>
          <button className="btn" onClick={() => void signOutUser()}>Sign out</button>
        </div>
      </div>
    );
  }

  // ── App shell ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">GL</div>
        <span className="topbar-title">Graded Lister</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 20 }}>
          <button
            className={`status-tab${view === "lookup" ? " active" : ""}`}
            onClick={() => setView("lookup")}
          >
            PSA Lookup
          </button>
          <button
            className={`status-tab${view === "listing" ? " active" : ""}`}
            onClick={() => { if (listing) setView("listing"); }}
            disabled={!listing}
            title={!listing ? "Look up a cert first" : undefined}
          >
            Build Listing
          </button>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)" }}>{user.email}</span>
        <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={() => void signOutUser()}>
          Sign out
        </button>
      </header>

      <main style={{ gridArea: "nav / nav / main / main", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {view === "lookup" ? (
          <CertLookup
            onReady={(cert, frontUrl, backUrl) => {
              setListing({ cert, frontUrl, backUrl });
              setView("listing");
            }}
          />
        ) : listing ? (
          <ListingBuilder
            cert={listing.cert}
            frontUrl={listing.frontUrl}
            backUrl={listing.backUrl}
            onBack={() => setView("lookup")}
          />
        ) : null}
      </main>
    </div>
  );
}
