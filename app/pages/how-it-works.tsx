import React from "react";

export default function HowItWorks() {
  return (
    <div className="intro">
      <h1 className="intro-title">How It Works</h1>

      <p>
        StealthNote is an application for people in an organization to anonymously
        broadcast messages. Here is how it works:
      </p>
      
      <h3>Sign in with Google</h3>
      <p>
        StealthNote only works for organizations that use Google Workspace. When
        you sign in with Google, Google returns  containing your
        organization&apos;s domain.
      </p>
    </div>
  );
}