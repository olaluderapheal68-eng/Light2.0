
const profileMessage = document.getElementById("profileMessage");
const profileDetails = document.getElementById("profileDetails");
const followButton = document.getElementById("followProfileButton");

const PROFILE_API_URL = "https://light2-0.onrender.com";

let currentUser = null;
let viewedProfile = null;
let viewedProfileId = null;

let followStatus = null;
let followRequestInProgress = false;

// ========================================
// LOAD PROFILE
// ========================================

async function loadProfile() {
  try {
    const { data: userData, error: userError } =
      await window.lightSupabase.auth.getUser();

    if (userError || !userData.user) {
      window.location.replace("index.html");
      return;
    }

    currentUser = userData.user;

    const params = new URLSearchParams(window.location.search);
    const requestedProfileId = params.get("id");

    viewedProfileId = requestedProfileId || currentUser.id;

    const isOwnProfile = viewedProfileId === currentUser.id;

    const { data: profile, error: profileError } =
      await window.lightSupabase
        .from("public_profiles")
        .select("*")
        .eq("id", viewedProfileId)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      profileMessage.textContent =
        "This profile is unavailable or private.";
      return;
    }

    viewedProfile = profile;

    renderProfile(profile, isOwnProfile);

    // Load profile statistics.
    await loadProfileStats();

    // Load follow status when viewing another user.
    if (!isOwnProfile) {
      await loadFollowStatus();
    }

    await loadUserPosts(viewedProfileId, isOwnProfile);

    profileMessage.textContent = "";
    profileDetails.hidden = false;

  } catch (error) {
    console.error("Profile loading failed:", error);

    profileMessage.textContent =
      "Could not load this profile. Please try again.";
  }
}


// ========================================
// LOAD FOLLOWERS AND FOLLOWING COUNTS
// ========================================

async function loadProfileStats() {
  const followersElement =
    document.getElementById("profileFollowers");

  const followingElement =
    document.getElementById("profileFollowing");

  if (!followersElement || !followingElement) return;

  try {
    const { data: sessionData, error: sessionError } =
      await window.lightSupabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error("Authentication session unavailable.");
    }

    const token = sessionData.session.access_token;

    const response = await fetch(
      `${PROFILE_API_URL}/api/users/${encodeURIComponent(viewedProfileId)}/follow-stats`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not load profile statistics."
      );
    }

    followersElement.textContent =
      Number(result.data?.followers || 0).toLocaleString();

    followingElement.textContent =
      Number(result.data?.following || 0).toLocaleString();

  } catch (error) {
    console.error("Loading profile statistics failed:", error);

    followersElement.textContent = "—";
    followingElement.textContent = "—";
  }
}


// ========================================
// LOAD FOLLOW STATUS
// ========================================

async function loadFollowStatus() {
  if (!followButton || !currentUser || !viewedProfileId) {
    return;
  }

  followButton.disabled = true;

  try {
    const { data, error } = await window.lightSupabase
      .from("follows")
      .select("id, status")
      .eq("follower_id", currentUser.id)
      .eq("following_id", viewedProfileId)
      .maybeSingle();

    if (error) throw error;

    followStatus = data?.status || null;

    updateFollowButton();

  } catch (error) {
    console.error("Loading follow status failed:", error);

    followButton.textContent = "Follow";
  } finally {
    followButton.disabled = false;
  }
}


// ========================================
// UPDATE FOLLOW BUTTON
// ========================================

function updateFollowButton() {
  if (!followButton) return;

  if (followStatus === "accepted") {
    followButton.textContent = "Following";
    followButton.classList.add("is-following");
    followButton.classList.remove("is-requested");

  } else if (followStatus === "pending") {
    followButton.textContent = "Requested";
    followButton.classList.add("is-requested");
    followButton.classList.remove("is-following");

  } else {
    followButton.textContent = "Follow";
    followButton.classList.remove("is-following");
    followButton.classList.remove("is-requested");
  }
}


// ========================================
// FOLLOW / UNFOLLOW USER
// ========================================

async function toggleFollow() {
  if (
    !followButton ||
    !currentUser ||
    !viewedProfileId ||
    followRequestInProgress
  ) {
    return;
  }

  if (viewedProfileId === currentUser.id) {
    return;
  }

  followRequestInProgress = true;
  followButton.disabled = true;

  const previousStatus = followStatus;

  try {
    const { data: sessionData, error: sessionError } =
      await window.lightSupabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error("Please log in again.");
    }

    const token = sessionData.session.access_token;

    const isAlreadyConnected =
      followStatus === "accepted" ||
      followStatus === "pending";

    const response = await fetch(
      `${PROFILE_API_URL}/api/users/${encodeURIComponent(viewedProfileId)}/follow`,
      {
        method: isAlreadyConnected ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not update follow status."
      );
    }

    if (isAlreadyConnected) {
      followStatus = null;
    } else {
      followStatus = result.data?.status || "accepted";
    }

    updateFollowButton();

    // Refresh statistics after a successful follow/unfollow.
    await loadProfileStats();

  } catch (error) {
    followStatus = previousStatus;
    updateFollowButton();

    console.error("Follow action failed:", error);

    alert(error.message || "Could not update follow status.");

  } finally {
    followRequestInProgress = false;
    followButton.disabled = false;
  }
}


// ========================================
// FOLLOW BUTTON EVENT
// ========================================

if (followButton) {
  followButton.addEventListener("click", toggleFollow);
}


// ========================================
// RENDER PROFILE
// ========================================

function renderProfile(profile, isOwnProfile) {
  const firstName = profile.first_name || "";
  const lastName = profile.last_name || "";

  const displayName =
    `${firstName} ${lastName}`.trim() || "Light User";

  document.getElementById("profileDisplayName").textContent =
    displayName;

  document.getElementById("profileHeading").textContent =
    displayName;

  document.getElementById("profileUsername").textContent =
    `@${profile.username || "lightuser"}`;

  document.getElementById("profileInitial").textContent =
    displayName.charAt(0).toUpperCase();

  document.getElementById("profileBio").textContent =
    profile.bio || "Welcome to Light.";

  document.getElementById("profileCountry").textContent =
    profile.location || profile.country
      ? `📍 ${profile.location || profile.country}`
      : "";

  document.getElementById("profileCreatedAt").textContent =
    profile.created_at
      ? `Joined ${new Date(profile.created_at).toLocaleDateString()}`
      : "";

  // Profile avatar
  const avatar = document.querySelector(".profile-avatar");

  if (avatar) {
    avatar.innerHTML = "";

    if (profile.avatar_url) {
      const image = document.createElement("img");

      image.src = profile.avatar_url;
      image.alt = `${displayName}'s profile photo`;

      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "cover";
      image.style.borderRadius = "50%";

      avatar.appendChild(image);

    } else {
      const initial = document.createElement("span");

      initial.id = "profileInitial";
      initial.textContent = displayName.charAt(0).toUpperCase();

      avatar.appendChild(initial);
    }
  }

  // Profile buttons
  const editButton =
    document.getElementById("editProfileButton");

  const messageButton =
    document.getElementById("messageProfileButton");

  const accountDetails =
    document.getElementById("accountDetails");

  if (editButton) {
    editButton.hidden = !isOwnProfile;
  }

  if (followButton) {
    followButton.hidden = isOwnProfile;
  }

  if (messageButton) {
    messageButton.hidden = isOwnProfile;
  }

  if (accountDetails) {
    accountDetails.hidden = !isOwnProfile;
  }

  // Own profile information
  if (isOwnProfile) {
    document.getElementById("profileFirstName").textContent =
      firstName;

    document.getElementById("profileLastName").textContent =
      lastName;

    document.getElementById("profileEmail").textContent =
      currentUser.email || "";

    document.getElementById("profilePhone").textContent =
      profile.phone_number || "";

  } else {
    if (messageButton) {
      messageButton.addEventListener(
        "click",
        startConversation
      );
    }
  }
}


// ========================================
// LOAD USER POSTS
// ========================================

async function loadUserPosts(userId, isOwnProfile) {
  const postsContainer =
    document.getElementById("profilePosts");

  postsContainer.textContent = "Loading posts...";

  const query = window.lightSupabase
    .from("posts")
    .select("id, content, created_at, user_id, visibility")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .is("reply_to_id", null)
    .order("created_at", { ascending: false });

  const { data: posts, error } = await query;

  if (error) {
    console.error("Profile posts error:", error);

    postsContainer.textContent = "Could not load posts.";
    return;
  }

  postsContainer.innerHTML = "";

  if (!posts || posts.length === 0) {
    postsContainer.textContent = isOwnProfile
      ? "You haven't published any public posts yet."
      : "This user hasn't published any public posts yet.";

    return;
  }

  posts.forEach(post => {
    const article = document.createElement("article");
    article.className = "profile-post-card";

    const author = document.createElement("strong");

    author.textContent =
      `${viewedProfile.first_name || ""} ${viewedProfile.last_name || ""}`.trim() ||
      "Light User";

    const content = document.createElement("p");
    content.textContent = post.content || "";

    const date = document.createElement("small");
    date.textContent = new Date(post.created_at).toLocaleString();

    article.append(author, content, date);

    postsContainer.appendChild(article);
  });
}


// ========================================
// START CONVERSATION
// ========================================

async function startConversation() {
  const button =
    document.getElementById("messageProfileButton");

  button.disabled = true;
  button.textContent = "Opening...";

  try {
    const { data, error } = await window.lightSupabase.rpc(
      "create_direct_conversation",
      {
        target_user_id: viewedProfileId
      }
    );

    if (error) throw error;

    if (!data) {
      throw new Error("Conversation could not be created.");
    }

    window.location.href =
      `messages.html?conversation=${encodeURIComponent(data)}`;

  } catch (error) {
    console.error("Starting conversation failed:", error);

    alert(error.message || "Could not start a conversation.");

    button.disabled = false;
    button.textContent = "Message";
  }
}


// ========================================
// INITIALIZE PROFILE
// ========================================

loadProfile();
