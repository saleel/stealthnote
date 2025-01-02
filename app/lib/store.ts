export function isMessageLiked(messageId: string) {
  return window.localStorage.getItem(`liked-${messageId}`) === "T";
}

export function setMessageLiked(messageId: string, liked: boolean) {
  if (!liked) {
    window.localStorage.removeItem(`liked-${messageId}`);
  } else {
    window.localStorage.setItem(`liked-${messageId}`, "T");
  }
}
