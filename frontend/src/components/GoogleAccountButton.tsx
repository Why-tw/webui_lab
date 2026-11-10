import { useEffect, useRef, useState } from "react";

import type { Messages } from "../resources/locales";

type GoogleProfile = {
    name: string;
    email: string;
    picture?: string;
};

type GoogleIdentityApi = {
    initialize: (options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
    }) => void;
    renderButton: (
        container: HTMLElement,
        options: {
            type: "standard";
            theme: "outline";
            size: "large";
            text: "signin_with";
            shape: "rectangular";
            width: number;
        },
    ) => void;
    disableAutoSelect: () => void;
};

declare global {
    interface Window {
        google?: {
            accounts?: {
                id?: GoogleIdentityApi;
            };
        };
    }
}

let googleScriptLoad: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (googleScriptLoad) return googleScriptLoad;

    googleScriptLoad = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (window.google?.accounts?.id) {
                resolve();
            } else {
                googleScriptLoad = null;
                reject(new Error("Google Identity Services did not initialize."));
            }
        };
        script.onerror = () => {
            script.remove();
            googleScriptLoad = null;
            reject(new Error("Google Identity Services failed to load."));
        };
        document.head.append(script);
    });

    return googleScriptLoad;
}

function decodeGoogleProfile(credential: string): GoogleProfile {
    const payload = credential.split(".")[1];
    if (!payload) throw new Error("Google returned an invalid credential.");

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
        (character) => character.charCodeAt(0),
    );
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!claims || typeof claims !== "object") throw new Error("Google returned invalid profile data.");

    const profile = claims as Record<string, unknown>;
    if (typeof profile.email !== "string") throw new Error("Google did not return an email address.");
    return {
        name: typeof profile.name === "string" ? profile.name : profile.email,
        email: profile.email,
        ...(typeof profile.picture === "string" ? { picture: profile.picture } : {}),
    };
}

type GoogleAccountButtonProps = {
    messages: Messages;
};

export function GoogleAccountButton({ messages }: GoogleAccountButtonProps) {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [profile, setProfile] = useState<GoogleProfile | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [signInError, setSignInError] = useState(false);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

    useEffect(() => {
        if (!clientId) return;

        let cancelled = false;
        void loadGoogleIdentityScript()
            .then(() => {
                if (cancelled || !buttonRef.current) return;
                const identity = window.google?.accounts?.id;
                if (!identity) throw new Error("Google Identity Services is unavailable.");

                identity.initialize({
                    client_id: clientId,
                    callback: (response) => {
                        if (cancelled) return;
                        if (!response.credential) {
                            setSignInError(true);
                            return;
                        }
                        try {
                            setProfile(decodeGoogleProfile(response.credential));
                            setSignInError(false);
                        } catch {
                            setSignInError(true);
                        }
                    },
                });
                identity.renderButton(buttonRef.current, {
                    type: "standard",
                    theme: "outline",
                    size: "large",
                    text: "signin_with",
                    shape: "rectangular",
                    width: 190,
                });
                setStatus("ready");
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus("error");
                    setSignInError(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [clientId]);

    function signOut() {
        window.google?.accounts?.id?.disableAutoSelect();
        setProfile(null);
    }

    return (
        <div className="google-account-control">
            {status !== "ready" && !profile && (
                <button className="google-account-status" type="button" disabled>
                    {!clientId
                        ? messages.account.notConfigured
                        : status === "loading"
                            ? messages.account.loading
                            : messages.account.signInError}
                </button>
            )}
            <div className="google-signin-host" ref={buttonRef} hidden={status !== "ready" || !!profile} />
            {profile && (
                <div className="google-account-profile">
                    {profile.picture && <img src={profile.picture} alt="" referrerPolicy="no-referrer" />}
                    <span className="google-account-identity">
                        <strong>{profile.name}</strong>
                        <span>{profile.email}</span>
                    </span>
                    <button type="button" onClick={signOut}>{messages.account.signOut}</button>
                </div>
            )}
            {signInError && (
                <span className="google-account-error" role="alert">{messages.account.signInError}</span>
            )}
        </div>
    );
}
