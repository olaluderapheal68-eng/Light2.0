
/* ==========================================
   LIGHT — MAIN FEED SCRIPT
========================================== */

/* ==========================================
   DOM ELEMENTS AND CONFIGURATION
========================================== */

const postForm = document.querySelector("#postForm");
const postText = document.querySelector("#postText");
const postList = document.querySelector("#postList");
const charCount = document.querySelector("#charCount");
const searchInput = document.querySelector("#searchInput");

const API_URL = "https://light2-0.onrender.com";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;

const selectedAttachments = [];

let activeFeed = "for-you";
let feedLoadRequest = 0;

const profileCache = new Map();


/* ==========================================
   AUTHENTICATION
========================================== */

async function getSession() {
  if (!window.lightSupabase) {
    throw new Error("Supabase has not been initialized.");
  }

  const { data, error } =
    await window.lightSupabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    throw new Error("Please sign in to continue.");
  }

  return data.session;
}


async function getAccessToken() {
  const session = await getSession();
  return session.access_token;
}


/* ==========================================
   PROFILE LOOKUP
========================================== */

async function loadAuthorProfiles(posts) {
  const userIds = [
    ...new Set(
      posts
        .map(post => post.user_id)
        .filter(Boolean)
    )
  ];

  const missingIds = userIds.filter(
    id => !profileCache.has(id)
  );

  if (missingIds.length === 0) {
    return;
  }

  try {
    const { data, error } = await window.lightSupabase
      .from("profiles")
      .select("id, first_name, last_name, username, avatar_url")
      .in("id", missingIds);

    if (error) {
      throw error;
    }

    (data || []).forEach(profile => {
      profileCache.set(profile.id, profile);
    });

  } catch (error) {
    console.warn("Could not load post author profiles:", error);
  }
}


function getAuthorDisplayName(profile, userId) {
  if (!profile) {
    return userId === currentUserId ? "You" : "Light user";
  }

  const fullName = [
    profile.first_name,
    profile.last_name
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) return fullName;

  if (profile.username) return profile.username;

  return userId === currentUserId ? "You" : "Light user";
}


let currentUserId = null;


/* ==========================================
   SECURE ATTACHMENT VIEWING
========================================== */

async function getAttachmentUrl(postId, path) {
  const token = await getAccessToken();

  const response = await fetch(
    `${API_URL}/api/attachments/signed-read-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        post_id: postId,
        path: path
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Could not load attachment."
    );
  }

  return result.data.signed_url;
}


/* ==========================================
   UPLOAD ATTACHMENTS
========================================== */

async function uploadAttachment(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `${file.name} is larger than 50 MB.`
    );
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      `${file.name} has an unsupported file type.`
    );
  }

  const accessToken = await getAccessToken();

  const urlResponse = await fetch(
    `${API_URL}/api/attachments/upload-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        file_name: file.name,
        mime_type: file.type
      })
    }
  );

  const urlResult = await urlResponse.json();

  if (!urlResponse.ok || !urlResult.success) {
    throw new Error(
      urlResult.message || "Could not prepare file upload."
    );
  }

  const { path, token } = urlResult.data;

  const { error } = await window.lightSupabase.storage
    .from("post-attachments")
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size
  };
}


/* ==========================================
   ATTACHMENT PICKER
========================================== */

function setupAttachmentPicker() {
  const imageInput = document.getElementById("imageInput");
  const videoInput = document.getElementById("videoInput");
  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("attachmentPreview");

  if (!imageInput || !fileInput || !preview) return;

  function renderAttachmentPreview() {
    preview.innerHTML = "";

    selectedAttachments.forEach((attachment, index) => {
      const item = document.createElement("div");
      item.className = "attachment-preview-item";

      const name = document.createElement("span");

      const file = attachment.file;
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");

      const icon = isVideo ? "🎥 " : isImage ? "🖼️ " : "📎 ";

      name.textContent = icon + file.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";

      remove.addEventListener("click", () => {
        selectedAttachments.splice(index, 1);
        renderAttachmentPreview();
      });

      item.append(name, remove);
      preview.appendChild(item);
    });
  }

  function addFiles(files) {
    for (const file of files) {
      if (selectedAttachments.length >= MAX_ATTACHMENTS) {
        alert("You can attach up to 4 files per post.");
        break;
      }

      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} is larger than 50 MB.`);
        continue;
      }

      const alreadyAdded = selectedAttachments.some(
        item =>
          item.file.name === file.name &&
          item.file.size === file.size
      );

      if (!alreadyAdded) {
        selectedAttachments.push({ file });
      }
    }

    renderAttachmentPreview();
  }

  imageInput.addEventListener("change", () => {
    addFiles(imageInput.files);
    imageInput.value = "";
  });

  if (videoInput) {
    videoInput.addEventListener("change", () => {
      addFiles(videoInput.files);
      videoInput.value = "";
    });
  }

  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });
}

setupAttachmentPicker();


/* ==========================================
   EMOJI PICKER
========================================== */

function setupEmojiPicker() {
  const emojiButton = document.getElementById("emojiButton");
  const emojiPicker = document.getElementById("emojiPicker");

  if (!emojiButton || !emojiPicker || !postText) return;

  emojiButton.addEventListener("click", () => {
    emojiPicker.hidden = !emojiPicker.hidden;
  });

  emojiPicker.querySelectorAll(".emoji-option").forEach(button => {
    button.addEventListener("click", () => {
      const emoji = button.textContent.trim();

      const start = postText.selectionStart;
      const end = postText.selectionEnd;

      postText.setRangeText(emoji, start, end, "end");
      postText.focus();

      postText.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      emojiPicker.hidden = true;
    });
  });
}

setupEmojiPicker();


/* ==========================================
   CHARACTER COUNTER
========================================== */

if (postText && charCount) {
  postText.addEventListener("input", () => {
    charCount.textContent =
      `${postText.value.length} / 280`;
  });
}


/* ==========================================
   ATTACHMENT DISPLAY
========================================== */

function renderPostAttachments(postId, attachments, body) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return;
  }

  const container = document.createElement("div");
  container.className = "post-attachments";

  attachments.forEach(attachment => {
    const item = document.createElement("div");
    item.className = "post-attachment";

    const loading = document.createElement("p");
    loading.textContent =
      `Loading ${attachment.file_name || "attachment"}...`;

    item.appendChild(loading);
    container.appendChild(item);

    getAttachmentUrl(postId, attachment.path)
      .then(signedUrl => {
        item.innerHTML = "";

        const mimeType = attachment.mime_type || "";

        // IMAGE
        if (mimeType.startsWith("image/")) {
          const image = document.createElement("img");

          image.src = signedUrl;
          image.alt = attachment.file_name || "Post image";
          image.className = "post-image";
          image.loading = "lazy";

          image.addEventListener("error", () => {
            image.replaceWith(
              document.createTextNode(
                "Image could not be displayed."
              )
            );
          });

          item.appendChild(image);
        }

        // VIDEO
        else if (mimeType.startsWith("video/")) {
          const video = document.createElement("video");

          video.src = signedUrl;
          video.controls = true;
          video.playsInline = true;
          video.preload = "metadata";
          video.className = "post-video";

          video.addEventListener("error", () => {
            item.textContent = "Video could not be played.";
          });

          item.appendChild(video);
        }

        // DOCUMENT
        else {
          const link = document.createElement("a");

          link.href = signedUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "post-file-link";

          link.textContent =
            `📎 ${attachment.file_name || "Open attachment"}`;

          item.appendChild(link);
        }
      })
      .catch(error => {
        console.error("Attachment display failed:", error);

        loading.textContent =
          `${attachment.file_name || "Attachment"} could not be loaded.`;
      });
  });

  body.appendChild(container);
}


/* ==========================================
   POST AUTHOR DISPLAY
========================================== */

function createAuthorAvatar(profile, userId) {
  const avatar = document.createElement("div");
  avatar.className = "post-avatar";

  if (profile && profile.avatar_url) {
    const image = document.createElement("img");

    image.src = profile.avatar_url;
    image.alt = "Profile picture";
    image.loading = "lazy";

    image.addEventListener("error", () => {
      image.remove();
      avatar.textContent = getAuthorInitial(profile, userId);
    });

    avatar.appendChild(image);
  } else {
    avatar.textContent = getAuthorInitial(profile, userId);
  }

  return avatar;
}


function getAuthorInitial(profile, userId) {
  if (profile) {
    const name = profile.first_name ||
      profile.username ||
      profile.last_name;

    if (name) {
      return name.charAt(0).toUpperCase();
    }
  }

  return userId === currentUserId ? "Y" : "L";
}


/* ==========================================
   CREATE AND DISPLAY A POST
========================================== */

function formatPostTime(createdAt) {
  if (!createdAt) return "";

  const postDate = new Date(createdAt);

  if (Number.isNaN(postDate.getTime())) return "";

  const now = new Date();
  const seconds = Math.floor((now - postDate) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;

  return postDate.toLocaleDateString();
}

function createPost(postOrText, legacyPostId, authorProfile = null) {

  // Support old and new calling formats.
  const post =
    typeof postOrText === "object" && postOrText !== null
      ? postOrText
      : {
          content: postOrText,
          id: legacyPostId,
          attachments: []
        };

  const content =
    typeof post.content === "string" ? post.content : "";

  const postId = post.id;

  const attachments = Array.isArray(post.attachments)
    ? post.attachments
    : [];

  if (!postList || !postId) {
    console.error("Cannot display post:", post);
    return;
  }

  const profile =
    authorProfile ||
    profileCache.get(post.user_id) ||
    null;

  const article = document.createElement("article");
  article.className = "post";
  article.dataset.postId = postId;

  // Avatar
  const avatar = createAuthorAvatar(profile, post.user_id);

  // Post body
  const body = document.createElement("div");
  body.className = "post-body";

  // Metadata
  const meta = document.createElement("div");
  meta.className = "post-meta";

  const name = document.createElement("strong");
  name.textContent = getAuthorDisplayName(
    profile,
    post.user_id
  );

  const handle = document.createElement("span");

  if (profile && profile.username) {
    handle.textContent = `@${profile.username}`;
  } else {
    handle.textContent =
      post.user_id === currentUserId ? "@you" : "";
  }

// Post publication time
const time = document.createElement("span");
time.className = "post-time";
time.textContent = formatPostTime(post.created_at);

if (post.created_at) {
  time.title = new Date(post.created_at).toLocaleString();
}

meta.append(name, handle, time);
body.appendChild(meta);
  // Post text
  if (content) {
    const message = document.createElement("p");
    message.textContent = content;
    body.appendChild(message);
  }

  // Attachments
  renderPostAttachments(postId, attachments, body);

  // Actions
  const actions = document.createElement("div");
  actions.className = "post-actions";

  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.textContent = "♡ Like (0)";
  likeButton.disabled = true;
  likeButton.setAttribute("aria-pressed", "false");

  const replyButton = document.createElement("button");
  replyButton.type = "button";
  replyButton.textContent = "◯ Reply";

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.textContent = "↗ Share";

  actions.append(likeButton, replyButton, shareButton);
  body.appendChild(actions);

  article.append(avatar, body);

  // Reply
  replyButton.addEventListener("click", () => {
    window.location.href =
      `post.html?id=${encodeURIComponent(postId)}`;
  });

  // Share
  shareButton.addEventListener("click", async () => {
    const postUrl =
      `https://light20-frontend.vercel.app/post.html?id=${encodeURIComponent(postId)}`;

    const shareData = {
      title: "Light",
      text: content || "Check out this post on Light!",
      url: postUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(postUrl);
        alert("Post link copied successfully!");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Post sharing failed:", error);

        try {
          await navigator.clipboard.writeText(postUrl);
          alert("Post link copied successfully!");
        } catch {
          alert("Unable to share or copy this post link.");
        }
      }
    }
  });


  /* ========================================
     REFRESH LIKE STATUS
  ======================================== */

  async function refreshLikeButton() {
    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_URL}/api/posts/${postId}/likes`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not load likes."
        );
      }

      likeButton.textContent =
        `${result.likedByMe ? "♥" : "♡"} Like (${result.count})`;

      likeButton.setAttribute(
        "aria-pressed",
        String(Boolean(result.likedByMe))
      );

      likeButton.disabled = false;

    } catch (error) {
      console.error("Loading likes failed:", error);
    }
  }


  /* ========================================
     LIKE AND UNLIKE
  ======================================== */

  likeButton.addEventListener("click", async () => {
    if (likeButton.disabled) return;

    const wasLiked =
      likeButton.getAttribute("aria-pressed") === "true";

    const countMatch =
      likeButton.textContent.match(/\((\d+)\)/);

    const oldCount = countMatch
      ? Number(countMatch[1])
      : 0;

    const newLiked = !wasLiked;

    const newCount = Math.max(
      0,
      oldCount + (newLiked ? 1 : -1)
    );

    // Optimistic update
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
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not update like."
        );
      }

    } catch (error) {
      console.error("Updating like failed:", error);

      // Restore original state.
      likeButton.textContent =
        `${wasLiked ? "♥" : "♡"} Like (${oldCount})`;

      likeButton.setAttribute(
        "aria-pressed",
        String(wasLiked)
      );

      alert("Your like could not be saved. Please try again.");

    } finally {
      likeButton.disabled = false;
    }
  });


  // Display newest post at the top.
  postList.prepend(article);

  // Load like information.
  refreshLikeButton();
}


/* ==========================================
   LOAD POSTS FROM BACKEND
========================================== */

async function loadPosts(feedType = activeFeed) {
  if (!postList) return;

  const requestId = ++feedLoadRequest;

  try {
    const session = await getSession();

    currentUserId = session.user.id;

    const response = await fetch(
      `${API_URL}/api/posts`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Could not load posts."
      );
    }

    if (!Array.isArray(result.data)) {
      throw new Error("Invalid posts response from server.");
    }

    let posts = result.data;

    // FOLLOWING FEED
    if (feedType === "following") {
      const { data: follows, error: followsError } =
        await window.lightSupabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId)
          .eq("status", "accepted");

      if (followsError) {
        throw new Error(followsError.message);
      }

      const followingIds = new Set(
        (follows || []).map(follow => follow.following_id)
      );

      posts = posts.filter(post =>
        followingIds.has(post.user_id)
      );
      console.log("CURRENT USER:", currentUserId);
console.log("FOLLOWING IDS:", [...followingIds]);
console.log("FILTERED POSTS:", posts.length);
console.log("FILTERED POST DATA:", posts);
    }

    // Ignore requests that are no longer current.
    if (requestId !== feedLoadRequest) return;

    // Load the authors of the posts being displayed.
    await loadAuthorProfiles(posts);

posts.slice(0, 3).forEach(post => {
  console.log("POST AUTHOR CHECK:", {
    postUserId: post.user_id,
    authorProfile: profileCache.get(post.user_id)
  });
});

    // Check again after asynchronous profile lookup.
    if (requestId !== feedLoadRequest) return;

    postList.innerHTML = "";

    if (posts.length === 0) {
      const emptyMessage = document.createElement("p");

      emptyMessage.className = "feed-empty-message";

      emptyMessage.textContent =
        feedType === "following"
          ? "No posts yet from people you follow."
          : "No posts available yet.";

      postList.appendChild(emptyMessage);
      return;
    }

    // Backend returns newest first.
    // Reverse because createPost prepends posts.
    [...posts].reverse().forEach(post => {
      createPost(
        post,
        null,
        profileCache.get(post.user_id) || null
      );
    });
console.log(
  "POST ELEMENTS RENDERED:",
  postList.querySelectorAll(".post").length
);

console.log(
  "POST LIST HTML:",
  postList.innerHTML
);

console.log(
  "POST LIST DISPLAY:",
  getComputedStyle(postList).display
);

console.log(
  "POST LIST VISIBILITY:",
  getComputedStyle(postList).visibility
);

console.log(
  "POST LIST HEIGHT:",
  postList.getBoundingClientRect().height
);
    // Reapply search after rendering.
    applyPostSearch();
const firstPost = postList.querySelector(".post");

if (firstPost) {
  console.log("FIRST POST:", firstPost);

  console.log(
    "FIRST POST POSITION:",
    firstPost.getBoundingClientRect()
  );

  console.log(
    "FIRST POST STYLE:",
    {
      display: getComputedStyle(firstPost).display,
      visibility: getComputedStyle(firstPost).visibility,
      opacity: getComputedStyle(firstPost).opacity,
      color: getComputedStyle(firstPost).color,
      background: getComputedStyle(firstPost).backgroundColor
    }
  );

  console.log("POST LIST PARENT:", postList.parentElement);

  console.log(
    "PARENT STYLE:",
    {
      display: getComputedStyle(postList.parentElement).display,
      visibility: getComputedStyle(postList.parentElement).visibility,
      opacity: getComputedStyle(postList.parentElement).opacity
    }
  );
}
  } catch (error) {
    // Do not allow an old request to overwrite the latest feed.
    if (requestId !== feedLoadRequest) return;

    console.error("Loading posts failed:", error);

    postList.innerHTML = "";

    const errorMessage = document.createElement("p");

    errorMessage.textContent =
      error.message || "Could not load posts.";

    postList.appendChild(errorMessage);
  }
}


/* ==========================================
   CREATE A NEW POST
========================================== */

if (postForm) {
  postForm.addEventListener("submit", async event => {
    event.preventDefault();

    const text = postText
      ? postText.value.trim()
      : "";

    if (!text && selectedAttachments.length === 0) {
      alert("Write something or attach a file before posting.");
      return;
    }

    const submitButton =
      postForm.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Posting...";
    }

    try {
      const token = await getAccessToken();

      // Upload selected attachments.
      const attachments = [];

      for (const item of selectedAttachments) {
        const uploadedFile = await uploadAttachment(item.file);
        attachments.push(uploadedFile);
      }

      // Create post.
      const response = await fetch(
        `${API_URL}/api/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            content: text,
            attachments
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not create post."
        );
      }

      // Reset composer.
      postForm.reset();

      selectedAttachments.length = 0;

      const preview =
        document.getElementById("attachmentPreview");

      if (preview) {
        preview.innerHTML = "";
      }

      if (charCount) {
        charCount.textContent = "0 / 280";
      }

      // Refresh the currently selected feed.
      // This prevents a new post from appearing in the wrong feed.
      await loadPosts(activeFeed);

    } catch (error) {
      console.error("Post creation failed:", error);

      alert(
        error.message ||
        "Could not publish your post. Please try again."
      );

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Post";
      }
    }
  });
}


/* ==========================================
   FEED TABS
========================================== */

document.querySelectorAll("[data-feed]").forEach(tab => {
  tab.addEventListener("click", async () => {
    const selectedFeed = tab.dataset.feed;

    if (!selectedFeed || selectedFeed === activeFeed) {
      return;
    }

    document.querySelectorAll("[data-feed]").forEach(item => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    activeFeed = selectedFeed;

    await loadPosts(activeFeed);
  });
});


/* ==========================================
   SIDEBAR POST BUTTON
========================================== */

const sidebarPost = document.querySelector("#sidebarPost");

if (sidebarPost && postText && postForm) {
  sidebarPost.addEventListener("click", () => {
    postText.focus();

    postForm.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });
}


/* ==========================================
   SEARCH POSTS
========================================== */

function applyPostSearch() {
  if (!postList) return;

  const query = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";

  postList.querySelectorAll(".post").forEach(post => {
    post.hidden = !post.textContent
      .toLowerCase()
      .includes(query);
  });
}


if (searchInput && postList) {
  searchInput.addEventListener("input", applyPostSearch);
}


/* ==========================================
   INITIAL FEED LOAD
========================================== */

if (postList) {
  loadPosts(activeFeed);
}


/* ==========================================
   END OF LIGHT MAIN FEED SCRIPT
========================================== */
