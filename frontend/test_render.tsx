import React from "react";
import ReactDOMServer from "react-dom/server";
import UserProfileModal from "./src/components/UserProfileModal";

const testRender = () => {
  try {
    const html = ReactDOMServer.renderToString(
      <UserProfileModal 
        username="@alexchen"
        onClose={() => {}}
        feedItems={[
          {
            id: "1",
            authorUsername: "@alexchen",
            authorName: "Alex Chen",
            authorAvatar: "AC",
            category: "PROGRAMMING",
            content: "Test content",
            timeLabel: "1 hr ago",
            likes: 10,
            likedByUser: false,
            isFollowed: false
          }
        ]}
        userDecks={[]}
        onToggleFollow={() => {}}
        onStudyDeck={() => {}}
        userEmail="test@test.com"
      />
    );
    console.log("SUCCESS:", html.substring(0, 100));
  } catch (err) {
    console.error("ERROR:");
    console.error(err);
  }
};

testRender();
