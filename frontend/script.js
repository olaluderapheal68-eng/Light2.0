
// ==========================================
// LIGHT — MAIN FEED SCRIPT
// ==========================================

// ==========================================
// DOM ELEMENTS AND CONFIGURATION
// ==========================================

const postForm = document.querySelector("#postForm");
const postText = document.querySelector("#postText");
const postList = document.querySelector("#postList");
const charCount = document.querySelector("#charCount");
const searchInput = document.querySelector("#searchInput");

const API_URL =  "https://light2-0.onrender.com";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;

const selectedAttachments = [];


// ==========================================
// AUTHENTICATION
// ==========================================

async function getAccessToken() {
  if (!window.lightSupabase) {
    throw new Error("Supabase has not been initialized.");
  }

  const { data, error } =
    await window.lightSupabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    throw new Error("Please sign in to continue.");
  }

  return data.session.access_token;
}

async function getAttachmentUrl(postId, attachmentPath) {
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
        path: attachmentPath
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Unable to load attachment."
    );
  }

  return result.data.signed_url;
}



// ==========================================
// SECURE ATTACHMENT VIEWING
// ==========================================

async function getAttachmentUrl(postId, path) {
  const token = await getAccessToken();

  const response = await fetch(
    `${API_URL}/api/attachments/signed-read-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        post_id: postId,
        path: path,
      }),
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


// ==========================================
// UPLOAD ATTACHMENTS
// ==========================================


async function uploadAttachment(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} is larger than 10 MB.`);
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
    throw new Error(`${file.name} has an unsupported file type.`);
  }

  console.log("Selected attachment:", {
  name: file.name,
  type: file.type,
  size: file.size
});

  const accessToken = await getAccessToken();

  const urlResponse = await fetch(
    `${API_URL}/api/attachments/upload-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        file_name: file.name,
        mime_type: file.type,
      }),
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
      contentType: file.type,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    path: path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
  };
}


// ==========================================
// ATTACHMENT PICKER
// ==========================================


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

      const isVideo = attachment.file.type.startsWith("video/");
      name.textContent = `${isVideo ? "🎥 " : ""}${attachment.file.name}`;

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
        selectedAttachments.push({
          file: file,
        });
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



// ==========================================
// EMOJI PICKER
// ==========================================

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


// ==========================================
// CHARACTER COUNTER
// ==========================================

if (postText && charCount) {
  postText.addEventListener("input", () => {
    charCount.textContent =
      `${postText.value.length} / 280`;
  });
}


// ==========================================
// ATTACHMENT DISPLAY
// ==========================================


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

        // IMAGE ATTACHMENT
        if (mimeType.startsWith("image/")) {
          const image = document.createElement("img");

          image.src = signedUrl;
          image.alt = attachment.file_name || "Post image";
          image.className = "post-image";
          image.loading = "lazy";

          image.addEventListener("error", () => {
            image.replaceWith(
              document.createTextNode("Image could not be displayed.")
            );
          });

          item.appendChild(image);
        }

        // VIDEO ATTACHMENT
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

        // DOCUMENT ATTACHMENT
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


// ==========================================
// CREATE AND DISPLAY A POST
// ==========================================

function createPost(postOrText, legacyPostId) {

  // Support both the old and new calling formats.
  const post =
    typeof postOrText === "object" && postOrText !== null
      ? postOrText
      : {
          content: postOrText,
          id: legacyPostId,
          attachments: [],
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

  meta.append(name, handle);
  body.appendChild(meta);

  // Post text
  if (content) {
    const message = document.createElement("p");
    message.textContent = content;
    body.appendChild(message);
  }

  // Post attachments
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
  shareButton.disabled = true;

  actions.append(likeButton, replyButton, shareButton);

  body.appendChild(actions);
  article.append(avatar, body);

  // Reply
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

  // ========================================
  // LIKE AND UNLIKE
  // ========================================

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

    // Update the interface immediately.
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
          result.message || "Could not update like."
        );
      }

    } catch (error) {
      console.error("Updating like failed:", error);

      // Restore the original state.
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


// ==========================================
// LOAD POSTS FROM BACKEND
// ==========================================

async function loadPosts() {
  if (!postList) return;

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
        result.message || "Could not load posts."
      );
    }

    if (!Array.isArray(result.data)) {
      throw new Error("Invalid posts response from server.");
    }

    postList.innerHTML = "";

    // Backend returns newest first.
    // Reverse because createPost prepends each post.
    [...result.data].reverse().forEach(post => {
      createPost(post);
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

      // Create the post.
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
            attachments: attachments,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not create post."
        );
      }

      // Pass the complete post object.
      createPost(result.data);

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


// ==========================================
// FEED TABS
// ==========================================

document.querySelectorAll("[data-feed]").forEach(tab => {
  tab.addEventListener("click", () => {

    document.querySelectorAll("[data-feed]").forEach(item => {
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

    document.querySelectorAll("#postList .post").forEach(post => {
      post.hidden = !post.textContent
        .toLowerCase()
        .includes(query);
    });
  });
}

// ==========================================
// END OF LIGHT MAIN FEED SCRIPT
// ==========================================
