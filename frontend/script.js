
// ==========================================
// LIGHT — MAIN FEED SCRIPT
// ==========================================

// DOM elements
const postForm = document.querySelector("#postForm");
const postText = document.querySelector("#postText");
const postList = document.querySelector("#postList");
const charCount = document.querySelector("#charCount");
const searchInput = document.querySelector("#searchInput");

const API_URL = "https://light2-0.onrender.com";


// ==========================================
// CHARACTER COUNTER
// ==========================================

if (postText && charCount) {
  postText.addEventListener("input", () => {
    charCount.textContent = `${postText.value.length} / 280`;
  });
}


// ==========================================
// AUTHENTICATION
// ==========================================

async function getAccessToken() {
  const { data, error } =
    await window.lightSupabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    throw new Error("Please sign in to continue.");
  }

  return data.session.access_token;
}


// ==========================================
// CREATE AND DISPLAY A POST
// ==========================================

function createPost(text, postId) {
  const article = document.createElement("article");
  article.className = "post";
  article.dataset.postId = postId;

  // Avatar
  const avatar = document.createElement("div");
  avatar.className = "post-avatar";
  avatar.textContent = "R";

  // Post body
  const body = document.createElement("div");
  body.className = "post-body";

  // Post metadata
  const meta = document.createElement("div");
  meta.className = "post-meta";

  const name = document.createElement("strong");
  name.textContent = "You";

  const handle = document.createElement("span");
  handle.textContent = "@you";

  // Post content
  const message = document.createElement("p");
  message.textContent = text;

  // Actions container
  const actions = document.createElement("div");
  actions.className = "post-actions";

  // Like button
  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.textContent = "♡ Like (0)";
  likeButton.disabled = true;
  likeButton.setAttribute("aria-pressed", "false");

  // Reply button
  const replyButton = document.createElement("button");
  replyButton.type = "button";
  replyButton.textContent = "◯ Reply";

  // Share button
  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.textContent = "↗ Share";
  shareButton.disabled = true;

  actions.append(likeButton, replyButton, shareButton);

  // ========================================
  // REPLY — OPEN CONVERSATION PAGE
  // ========================================

  replyButton.addEventListener("click", () => {
    window.location.href = `post.html?id=${postId}`;
  });


  // ========================================
  // REFRESH LIKE STATUS
  // ========================================

  async function refreshLikeButton() {
    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_URL}/api/posts/${postId}/likes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Could not load likes"
        );
      }

      likeButton.textContent =
        `${result.likedByMe ? "♥" : "♡"} Like (${result.count})`;

      likeButton.setAttribute(
        "aria-pressed",
        String(result.likedByMe)
      );

      likeButton.disabled = false;

    } catch (error) {
      console.error("Loading likes failed:", error);
    }
  }


  // ========================================
  // LIKE AND UNLIKE A POST
  // ========================================

  likeButton.addEventListener("click", async () => {
    if (likeButton.disabled) return;

    const wasLiked =
      likeButton.getAttribute("aria-pressed") === "true";

    const countMatch = likeButton.textContent.match(/\((\d+)\)/);
    const oldCount = countMatch ? Number(countMatch[1]) : 0;

    const newLiked = !wasLiked;

    const newCount = Math.max(
      0,
      oldCount + (newLiked ? 1 : -1)
    );

    // Update the interface immediately
    likeButton.textContent =
      `${newLiked ? "♥" : "♡"} Like (${newCount})`;

    likeButton.setAttribute(
      "aria-pressed",
      String(newLiked)
    );

    likeButton.disabled = true;

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_URL}/api/posts/${postId}/likes`,
        {
          method: newLiked ? "POST" : "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Could not update like"
        );
      }

    } catch (error) {
      // Restore the original state
      likeButton.textContent =
        `${wasLiked ? "♥" : "♡"} Like (${oldCount})`;

      likeButton.setAttribute(
        "aria-pressed",
        String(wasLiked)
      );

      console.error("Updating like failed:", error);

      alert("Your like could not be saved. Please try again.");

    } finally {
      likeButton.disabled = false;
    }
  });


  // ========================================
  // BUILD THE POST
  // ========================================

  meta.append(name, handle);

  body.append(meta, message, actions);

  article.append(avatar, body);

  postList.prepend(article);

  // Load the correct like count and status
  refreshLikeButton();
}


// ==========================================
// LOAD POSTS FROM BACKEND
// ==========================================

async function loadPosts() {
  try {
    const token = await getAccessToken();

    const response = await fetch(
      `${API_URL}/api/posts`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || result.message || "Could not load posts"
      );
    }

    if (!Array.isArray(result.data)) {
      throw new Error("Invalid posts response from server.");
    }

    // Clear the feed before loading posts
    postList.innerHTML = "";

    // Display oldest first in the loop,
    // because createPost prepends each post
    result.data.forEach((post) => {
      createPost(post.content, post.id);
    });

  } catch (error) {
    console.error("Loading posts failed:", error);
  }
}


// ==========================================
// LOAD POSTS WHEN PAGE OPENS
// ==========================================

if (postList) {
  loadPosts();
}


// ==========================================
// CREATE A NEW POST
// ==========================================

if (postForm) {
  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = postText.value.trim();

    if (!text) return;

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_URL}/api/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: text,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Could not create post"
        );
      }

      // Display the newly created post
      createPost(result.data.content, result.data.id);

      // Reset form
      postForm.reset();

      if (charCount) {
        charCount.textContent = "0 / 280";
      }

    } catch (error) {
      console.error("Post creation failed:", error);

      alert(
        error.message ||
        "Could not publish your post. Please try again."
      );
    }
  });
}


// ==========================================
// FEED TABS
// ==========================================

document.querySelectorAll("[data-feed]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-feed]").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
  });
});


// ==========================================
// SIDEBAR POST BUTTON
// ==========================================

const sidebarPost = document.querySelector("#sidebarPost");

if (sidebarPost && postText && postForm) {
  sidebarPost.addEventListener("click", () => {
    postText.focus();

    postForm.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
}


// ==========================================
// SEARCH POSTS
// ==========================================

if (searchInput && postList) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    document.querySelectorAll("#postList .post").forEach((post) => {
      post.hidden = !post.textContent
        .toLowerCase()
        .includes(query);
    });
  });
}
