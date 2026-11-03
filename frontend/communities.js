
const API_URL = "https://light2-0.onrender.com";

const communityList = document.querySelector("#communityList");
const communitySearch = document.querySelector("#communitySearch");
const createCommunityForm = document.querySelector("#createCommunityForm");
const createCommunityButton = document.querySelector("#createCommunityButton");
const createCommunityModal = document.querySelector("#createCommunityModal");
const closeCommunityModal = document.querySelector("#closeCommunityModal");

let communities = [];
let activeTab = "discover";
let activeCategory = "All";

async function getAccessToken() {
  const { data, error } = await window.lightSupabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    throw new Error("Please sign in to continue.");
  }

  return data.session.access_token;
}

async function loadCommunities() {
  try {
    const token = await getAccessToken();

    const response = await fetch(`${API_URL}/api/communities`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || "Could not load communities.");
    }

    communities = Array.isArray(result.data) ? result.data : [];
    renderCommunities();

  } catch (error) {
    console.error("Loading communities failed:", error);
    communityList.textContent = error.message;
  }
}

function renderCommunities() {
  communityList.innerHTML = "";

  const query = communitySearch.value.trim().toLowerCase();

  const filtered = communities.filter((community) => {
    const matchesSearch =
      (community.name || "").toLowerCase().includes(query) ||
      (community.description || "").toLowerCase().includes(query);

    const matchesCategory =
      activeCategory === "All" ||
      community.category === activeCategory;

    const matchesTab =
      activeTab === "discover" ||
      community.is_member === true;

    return matchesSearch && matchesCategory && matchesTab;
  });

  if (filtered.length === 0) {
    communityList.textContent =
      activeTab === "joined"
        ? "You haven't joined any communities yet."
        : "No communities found. Try another search.";

    return;
  }

  filtered.forEach((community) => {
    const card = document.createElement("article");
    card.className = "community-card";

    const title = document.createElement("h2");
    title.textContent = community.name;

    const description = document.createElement("p");
    description.textContent = community.description || "No description available.";

    const details = document.createElement("small");
    details.textContent =
      `${community.category || "General"} · ${community.privacy || "public"}`;

    const action = document.createElement("button");
    action.type = "button";

    if (community.is_member) {
      action.textContent = "Joined";
      action.disabled = true;
    } else if (community.privacy === "private") {
      action.textContent = "Request to join";
      action.addEventListener("click", () => joinCommunity(community.id, action));
    } else {
      action.textContent = "Join";
      action.addEventListener("click", () => joinCommunity(community.id, action));
    }
card.append(title, description, details, action);

// Show pending requests to the community creator.
if (
  Array.isArray(community.pending_requests) &&
  community.pending_requests.length > 0
) {
  const requestsSection = document.createElement("div");
  requestsSection.className = "community-pending-requests";

  const heading = document.createElement("h3");
  heading.textContent = "Pending membership requests";

  requestsSection.appendChild(heading);

  community.pending_requests.forEach((request) => {
    const requestItem = document.createElement("div");
    requestItem.className = "community-request-item";

    const requestText = document.createElement("p");
    requestText.textContent =
      `Membership request #${request.membership_id}`;

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.textContent = "Approve";

    approveButton.addEventListener("click", () => {
      respondToCommunityRequest(
        request.membership_id,
        true,
        approveButton
      );
    });

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.textContent = "Reject";

    rejectButton.addEventListener("click", () => {
      respondToCommunityRequest(
        request.membership_id,
        false,
        rejectButton
      );
    });

    requestItem.append(
      requestText,
      approveButton,
      rejectButton
    );

    requestsSection.appendChild(requestItem);
  });

  card.appendChild(requestsSection);
}

communityList.appendChild(card);
   
  });
}

async function joinCommunity(communityId, button) {
  try {
    button.disabled = true;
    button.textContent = "Joining...";

    const token = await getAccessToken();

    const response = await fetch(
      `${API_URL}/api/communities/${communityId}/join`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || "Could not join community.");
    }

    await loadCommunities();

  } catch (error) {
    console.error("Joining community failed:", error);
    alert(error.message);
    button.disabled = false;
    button.textContent = "Try again";
  }
}

createCommunityButton.addEventListener("click", () => {
  createCommunityModal.hidden = false;
});

closeCommunityModal.addEventListener("click", () => {
  createCommunityModal.hidden = true;
});

createCommunityForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.querySelector("#communityName").value.trim();
  const description = document.querySelector("#communityDescription").value.trim();
  const category = document.querySelector("#communityCategory").value;
  const privacy = document.querySelector("#communityPrivacy").value;

  if (!name || !description || !category || !privacy) {
    alert("Please complete all fields.");
    return;
  }

  const submitButton = document.querySelector("#submitCommunityButton");

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Creating...";

    const token = await getAccessToken();

    const response = await fetch(`${API_URL}/api/communities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description,
        category,
        privacy,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || "Could not create community.");
    }

    createCommunityForm.reset();
    createCommunityModal.hidden = true;

    await loadCommunities();

  } catch (error) {
    console.error("Creating community failed:", error);
    alert(error.message);

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create Community";
  }
});

communitySearch.addEventListener("input", renderCommunities);

document.querySelectorAll("[data-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;

    document.querySelectorAll("[data-tab]").forEach((item) => {
      item.classList.toggle("active", item === tab);
    });

    renderCommunities();
  });
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;

    document.querySelectorAll("[data-category]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderCommunities();
  });
});

loadCommunities();

async function respondToCommunityRequest(
  membershipId,
  approve,
  button
) {
  try {
    button.disabled = true;
    button.textContent = "Processing...";

    const token = await getAccessToken();

    const response = await fetch(
      `${API_URL}/api/communities/requests/${membershipId}/respond`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ approve }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Could not process membership request."
      );
    }

    alert(result.message);
    await loadCommunities();

  } catch (error) {
    console.error("Responding to community request failed:", error);
    alert(error.message);

    button.disabled = false;
    button.textContent = approve ? "Approve" : "Reject";
  }
}