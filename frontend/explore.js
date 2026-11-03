
const lightClient = window.lightSupabase;

let currentUser = null;
let searchTimeout = null;

document.addEventListener("DOMContentLoaded", initializeExplore);

async function initializeExplore() {
  if (!lightClient) {
    showMessage("postResults", "Light client connection is unavailable.");
    return;
  }

  const { data, error } = await lightClient.auth.getUser();

  if (error || !data.user) {
    showMessage("postResults", "Please sign in to explore Light.");
    return;
  }

  currentUser = data.user;

  document
    .getElementById("searchButton")
    .addEventListener("click", searchPeople);

  document
    .getElementById("exploreSearch")
    .addEventListener("input", handleSearchInput);

  await loadPublicPosts();
}

function handleSearchInput(event) {
  clearTimeout(searchTimeout);

  const query = event.target.value.trim();

  if (!query) {
    showMessage("peopleResults", "Search for people to discover them.");
    return;
  }

  searchTimeout = setTimeout(searchPeople, 400);
}

async function searchPeople() {
  const input = document.getElementById("exploreSearch");
  const query = input.value.trim().replace(/^@/, "");

  if (!query) {
    showMessage("peopleResults", "Enter a name or username to search.");
    return;
  }

  showMessage("peopleResults", "Searching...");

  const { data, error } = await lightClient
    .from("public_profiles")
    .select("id, username, first_name, last_name, avatar_url")
    .or(
      `username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`
    )
    .neq("id", currentUser.id)
    .limit(20);

  if (error) {
    console.error("People search error:", error);
    showMessage("peopleResults", "Couldn't search for people. Please try again.");
    return;
  }

  renderPeople(data || []);
}

function renderPeople(people) {
  const container = document.getElementById("peopleResults");

  if (!people.length) {
    showMessage("peopleResults", "No matching people found.");
    return;
  }

  container.innerHTML = people.map(person => {
    const fullName = [person.first_name, person.last_name]
      .filter(Boolean)
      .join(" ") || "Light user";

    const initial = escapeHTML(fullName.charAt(0).toUpperCase());
    const username = escapeHTML(person.username || "user");

    const avatar = person.avatar_url
      ? `<img src="${escapeHTML(person.avatar_url)}" alt="">`
      : initial;

    return `
      <article class="person-card">
        <div class="person-avatar">${avatar}</div>
        <h3>${escapeHTML(fullName)}</h3>
        <p>@${username}</p>
        <button type="button" data-profile-id="${escapeHTML(person.id)}">
          View profile
        </button>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-profile-id]").forEach(button => {
    button.addEventListener("click", () => {
      const profileId = button.dataset.profileId;
      window.location.href =
        `profile.html?id=${encodeURIComponent(profileId)}`;
    });
  });
}

async function loadPublicPosts() {
  const container = document.getElementById("postResults");
  showMessage("postResults", "Loading public posts...");

  const { data, error } = await lightClient
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Explore posts error:", error);
    showMessage("postResults", "Couldn't load posts. Please try again.");
    return;
  }

  renderPosts(data || []);
}

function renderPosts(posts) {
  const container = document.getElementById("postResults");

  if (!posts.length) {
    showMessage("postResults", "No posts to discover yet.");
    return;
  }

  container.innerHTML = posts.map(post => `
    <article class="explore-post">
      <p>${escapeHTML(post.content || "")}</p>
      <small>${formatPostDate(post.created_at)}</small>
    </article>
  `).join("");
}

function formatPostDate(date) {
  if (!date) return "";

  return new Date(date).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showMessage(elementId, message) {
  const element = document.getElementById(elementId);

  if (element) {
    element.innerHTML = `<p class="explore-message">${escapeHTML(message)}</p>`;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}
