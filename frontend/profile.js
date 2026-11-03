
const profileMessage = document.getElementById("profileMessage");
const profileDetails = document.getElementById("profileDetails");

let currentUser = null;
let viewedProfile = null;
let viewedProfileId = null;

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

    const isOwnProfile = viewedProfileId === currentUser.id;

    renderProfile(profile, isOwnProfile);

    await loadUserPosts(viewedProfileId, isOwnProfile);

    profileMessage.textContent = "";
    profileDetails.hidden = false;

  } catch (error) {
    console.error("Profile loading failed:", error);
    profileMessage.textContent =
      "Could not load this profile. Please try again.";
  }
}

function renderProfile(profile, isOwnProfile) {
  const firstName = profile.first_name || "";
  const lastName = profile.last_name || "";
  const displayName =
    `${firstName} ${lastName}`.trim() || "Light User";

  document.getElementById("profileDisplayName").textContent = displayName;
  document.getElementById("profileHeading").textContent = displayName;
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

  const editButton = document.getElementById("editProfileButton");
  const messageButton = document.getElementById("messageProfileButton");
  const accountDetails = document.getElementById("accountDetails");

  editButton.hidden = !isOwnProfile;
  messageButton.hidden = isOwnProfile;
  accountDetails.hidden = !isOwnProfile;

  if (isOwnProfile) {
    document.getElementById("profileFirstName").textContent = firstName;
    document.getElementById("profileLastName").textContent = lastName;
    document.getElementById("profileEmail").textContent =
      currentUser.email || "";

    document.getElementById("profilePhone").textContent =
      profile.phone_number || "";
  } else {
    messageButton.addEventListener("click", startConversation);
  }
}

async function loadUserPosts(userId, isOwnProfile) {
  const postsContainer = document.getElementById("profilePosts");
  postsContainer.textContent = "Loading posts...";

  let query = window.lightSupabase
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

async function startConversation() {
  const button = document.getElementById("messageProfileButton");

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

loadProfile();
