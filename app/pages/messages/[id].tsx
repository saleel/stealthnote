import { useRouter } from "next/router";
import MessageCard from "../../components/message-card";
import Layout from "../../components/layout";
import { fetchMessage } from "../../lib/api";
import type { SignedMessageWithProof } from "../../lib/types";
import usePromise from "../../hooks/use-promise";

export default function SingleMessagePage() {
  const router = useRouter();
  const { id } = router.query;

  const [message, { isFetching }] = usePromise<SignedMessageWithProof>(
    () => fetchMessage(id as string),
    {
      dependencies: [id as string],
    }
  );


  if (isFetching || !message) {
    return (
      <Layout>
        <div className="flex-center">
          <div className="spinner-icon" />
        </div>
      </Layout>
    );
  }

  return (
    <div className="single-message-container">
      <MessageCard message={message} />

      {/* <div className="single-message-container-footer">
        <p>
          This message was posted on signed with the below public key
          <br />
          <code>
            {message.ephemeralPubkey}
          </code>
        </p>
        <p>
          Sender also provided a ZK proof of membership in {message.anonGroupId}
          using {message.anonGroupProvider}.
          <code>
            {message.proof}
          </code>
        </p>
        <p>
          Verifying the message signature and the ZK proof verifies that this post
          was submitted by a somone from {message.anonGroupId}.
        </p>
      </div> */}
    </div>
  );
}
