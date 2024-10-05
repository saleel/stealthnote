"use client";

import React from "react";
import Image from "next/image";

const SignInButton = (props: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) => {
  return (
    <button onClick={props.onClick} className="google-sign-in-button">
      <Image
        src="https://developers.google.com/identity/images/g-logo.png"
        alt="Google logo"
        width={24}
        height={24}
      />
      <span>Sign in with Google</span>
    </button>
  );
};

export default SignInButton;
