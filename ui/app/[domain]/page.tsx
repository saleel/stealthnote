'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';

// Remove the import for chat.module.css

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

export default function ChatPage() {
  const params = useParams();
  const domain = params.domain as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I help you today?", sender: 'bot' },
    { id: 2, text: "I have a question about your services.", sender: 'user' },
    { id: 3, text: "Sure, I'd be happy to help. What would you like to know?", sender: 'bot' },
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setMessages([...messages, { id: Date.now(), text: newMessage, sender: 'user' }]);
      setNewMessage('');
      // Here you would typically send the message to your backend
      // and then add the response to the messages array
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chatContainer">
      <h1 className="chatHeader">Chat for {domain}</h1>
      <div className="messageList">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            {message.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="inputArea">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="inputField"
        />
        <button onClick={handleSendMessage} className="sendButton">Send</button>
      </div>
    </div>
  );
}