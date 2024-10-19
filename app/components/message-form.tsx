import React, { useState } from "react";
import { isRegistered, submitMessage, getDomain } from "../lib/utils";
import dynamic from "next/dynamic";

const PostMessageForm: React.FC = () => {
  const [message, setMessage] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsPosting(true);

    try {
      const domain = getDomain();
      if (!domain) throw new Error("Domain not found");

      await submitMessage({
        domain,
        text: message,
        timestamp: Date.now(),
      });

      setMessage("");
    } catch (err) {
      console.error(err);
      window.alert("Failed to post message. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleSignIn = () => {
    // Implement Google Sign-In logic here
    console.log("Sign in with Google");
  };

  const isReg = isRegistered();

  return (
    <div className="message-form">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's happening?"
        maxLength={280}
        disabled={isPosting}
      />
      <div className="message-form-footer">
        <span className="character-count">{message.length}/280</span>
        
        {isReg ? (
          <button
            className="message-form-footer-button"
            onClick={handleSubmit}
            disabled={isPosting || message.length === 0}
          >
            {isPosting ? "Posting..." : "Post"}
          </button>
        ) : (
          <button onClick={handleSignIn}>Sign in with Google</button>
        )}
      </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(PostMessageForm), {
  ssr: false,
});
