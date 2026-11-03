
const originalPost = document.querySelector("#originalPost");
const replyList = document.querySelector("#replyList");
const replyForm = document.querySelector("#replyForm");
const replyContent = document.querySelector("#replyContent");
const replyMessage = document.querySelector("#replyMessage");
const replySubmit = document.querySelector("#replySubmit");

const API_URL = "https://light2-0.onrender.com";

async function getAccessToken() {
  const { data, error } =
    await window.lightSupabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    throw new Error("Please sign in to continue.");
  }

  return data.session.access_token;
}

function getPostId() {
  return new URLSearchParams(window.location.search).get("id");
}

function displayPost(post, container) {
  const article = document.createElement("article");
  article.className = "post-card";

  const author = document.createElement("p");
  author.textContent = post.profiles?.username
    ? `@${post.profiles.username}`
    : "Light user";

  const content = document.createElement("p");
  content.textContent = post.content;

  const date = document.createElement("small");
  date.textContent = new Date(post.created_at).toLocaleString();

  article.append(author, content, date);
  container.appendChild(article);
}

async function loadConversation() {
  try {
    const postId = getPostId();

    if (!postId) {
      originalPost.textContent = "Invalid post link.";
      return;
    }

    const token = await getAccessToken();

    const response = await fetch(
      `${API_URL}/api/posts/${encodeURIComponent(postId)}/thread`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Could not load conversation."
      );
    }

    if (!result.data?.original) {
      throw new Error("Post not found.");
    }

    originalPost.innerHTML = "";
    replyList.innerHTML = "";

    displayPost(result.data.original, originalPost);

    if (!result.data.replies?.length) {
      replyList.textContent =
        "No replies yet. Start the conversation!";
      return;
    }

    result.data.replies.forEach(reply => {
      displayPost(reply, replyList);
    });

  } catch (error) {
    console.error("Loading conversation failed:", error);
    originalPost.textContent = error.message;
  }
}

if (replyForm) {
  replyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = replyContent.value.trim();
    const postId = getPostId();

    if (!content) {
      replyMessage.textContent = "Please write a reply.";
      return;
    }

    if (!postId) {
      replyMessage.textContent = "Invalid post link.";
      return;
    }

    try {
      replySubmit.disabled = true;
      replySubmit.textContent = "Posting...";
      replyMessage.textContent = "";

      const token = await getAccessToken();

      const response = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          reply_to_id: postId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.error ||
          "Could not post reply."
        );
      }

      replyContent.value = "";
      replyMessage.textContent = "Reply posted successfully!";

      await loadConversation();

    } catch (error) {
      console.error("Reply submission failed:", error);
      replyMessage.textContent = error.message;

    } finally {
      replySubmit.disabled = false;
      replySubmit.textContent = "Post Reply";
    }
  });
}

loadConversation();
