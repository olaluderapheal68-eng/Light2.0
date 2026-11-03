
/* ========================================
   LIGHT — NOTIFICATIONS
======================================== */

const notificationList = document.querySelector("#notificationList");
const notificationCount = document.querySelector("#notificationCount");
const markAllReadButton = document.querySelector("#markAllRead");
const notificationTabs = document.querySelectorAll(".notification-tab");

let notifications = [];
let activeFilter = "all";
let currentUserId = null;

// ========================================
// GET AUTHENTICATED USER
// ========================================

async function getCurrentUser() {
  const { data, error } =
    await window.lightSupabase.auth.getUser();

  if (error || !data.user) {
    window.location.href = "login.html";
    throw new Error("Please sign in to continue.");
  }

  currentUserId = data.user.id;
  return data.user;
}

// ========================================
// FORMAT DATE
// ========================================

function formatNotificationDate(date) {
  if (!date) return "";

  return new Date(date).toLocaleString();
}

// ========================================
// GET NOTIFICATION ICON
// ========================================

function getNotificationIcon(type) {
  const value = String(type || "").toLowerCase();

  if (value.includes("like")) return "♥";
  if (value.includes("reply")) return "↩";
  if (value.includes("mention")) return "@";
  if (value.includes("follow")) return "♙";
  if (value.includes("community")) return "👥";

  return "●";
}

// ========================================
// LOAD ACTOR PROFILES
// ========================================

async function loadActorProfiles(notificationData) {
  const actorIds = [
    ...new Set(
      notificationData
        .map(notification => notification.actor_id)
        .filter(Boolean)
    )
  ];

  if (actorIds.length === 0) return {};

  const { data, error } = await window.lightSupabase
  .rpc("get_public_profiles", {
    profile_ids: actorIds
  });

 

  const profiles = {};
if (error) {
  console.error("PROFILE LOOKUP ERROR:", error);
  return {};
}

console.log("PROFILE LOOKUP RESULT:", data);
  (data || []).forEach(profile => {
    profiles[profile.id] = profile;
  });

  return profiles;
}
// ========================================
// GET ACTOR NAME
// ========================================

function getActorName(notification) {
  const profile = notification.actor;

  if (!profile) return "Someone";

  const fullName = [
    profile.first_name,
    profile.last_name
  ].filter(Boolean).join(" ").trim();

  return fullName || profile.username || "Someone";
}

// ========================================
// GET ACTOR AVATAR
// ========================================

function getActorAvatar(notification) {
  const profile = notification.actor;

  if (!profile) return "";

  return (
    profile.avatar_url ||
    profile.profile_picture ||
    profile.avatar ||
    ""
  );
}

// ========================================
// GET NOTIFICATION MESSAGE
// ========================================

function getNotificationMessage(notification) {
  const type = String(
    notification.notification_type || ""
  ).toLowerCase();

  const actorName = getActorName(notification);

  if (type.includes("like")) {
    return `${actorName} liked your post.`;
  }

  if (type.includes("reply")) {
    return `${actorName} replied to your post.`;
  }

  if (type.includes("mention")) {
    return `${actorName} mentioned you.`;
  }

  if (type.includes("follow")) {
    return `${actorName} followed you.`;
  }

  if (type.includes("community")) {
    return `${actorName} interacted with your community.`;
  }

  return notification.message || "You have a new notification.";
}

// ========================================
// FILTER NOTIFICATIONS
// ========================================

function getFilteredNotifications() {
  if (activeFilter === "all") {
    return notifications;
  }

  return notifications.filter(notification => {
    const type = String(
      notification.notification_type || ""
    ).toLowerCase();

    if (activeFilter === "likes") return type.includes("like");
    if (activeFilter === "replies") return type.includes("reply");
    if (activeFilter === "mentions") return type.includes("mention");
    if (activeFilter === "follows") return type.includes("follow");

    return false;
  });
}

// ========================================
// DISPLAY NOTIFICATIONS
// ========================================

function renderNotifications() {
  notificationList.innerHTML = "";

  const filtered = getFilteredNotifications();

  const unreadCount = notifications.filter(
    notification => !notification.is_read
  ).length;

  notificationCount.textContent =
    `${unreadCount} unread · ${notifications.length} total`;

  if (filtered.length === 0) {
    const empty = document.createElement("p");

    empty.className = "notification-empty";
    empty.textContent =
      notifications.length === 0
        ? "You don't have any notifications yet."
        : "No notifications in this category.";

    notificationList.appendChild(empty);
    return;
  }

  filtered.forEach(notification => {
    const card = document.createElement("article");

    card.className = "notification-card";

    if (!notification.is_read) {
      card.classList.add("unread");
    }

    const icon = document.createElement("div");
    icon.className = "notification-icon";
    icon.textContent = getNotificationIcon(
      notification.notification_type
    );

    const content = document.createElement("div");
    content.className = "notification-content";

    const actorName = document.createElement("strong");
    actorName.className = "notification-actor";
    actorName.textContent = getActorName(notification);

    const message = document.createElement("p");
    message.textContent = getNotificationMessage(notification);

    const date = document.createElement("time");
    date.textContent = formatNotificationDate(
      notification.created_at
    );

    const avatarUrl = getActorAvatar(notification);

    if (avatarUrl) {
      const avatar = document.createElement("img");
      avatar.className = "notification-avatar";
      avatar.src = avatarUrl;
      avatar.alt = getActorName(notification);
      avatar.onerror = () => avatar.remove();

      card.append(avatar);
    }

    content.append(message, date);
    card.append(icon, content);

    card.addEventListener("click", async () => {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id);
      }

      if (notification.post_id) {
        window.location.href =
          `post.html?id=${encodeURIComponent(notification.post_id)}`;
      }
    });

    notificationList.appendChild(card);
  });
}

// ========================================
// LOAD NOTIFICATIONS FROM SUPABASE
// ========================================

async function loadNotifications() {
  try {
    notificationList.textContent = "Loading notifications...";

    await getCurrentUser();

    const { data, error } = await window.lightSupabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    notifications = data || [];

    // Fetch the profiles of users who triggered notifications.
    const profiles = await loadActorProfiles(notifications);
    console.log("NOTIFICATION DATA:", notifications);
console.log("ACTOR IDS:", notifications.map(n => n.actor_id));
console.log("LOADED PROFILES:", profiles);

    notifications = notifications.map(notification => ({
      ...notification,
      actor: profiles[notification.actor_id] || null
    }));

    renderNotifications();

  } catch (error) {
    console.error("Loading notifications failed:", error);

    notificationList.textContent =
      "Could not load notifications. Please refresh the page.";
  }
}

// ========================================
// MARK ONE NOTIFICATION AS READ
// ========================================

async function markNotificationAsRead(notificationId) {
  try {
    const { error } = await window.lightSupabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("recipient_id", currentUserId);

    if (error) throw error;

    const notification = notifications.find(
      item => item.id === notificationId
    );

    if (notification) {
      notification.is_read = true;
    }

    renderNotifications();

  } catch (error) {
    console.error("Marking notification as read failed:", error);
  }
}

// ========================================
// MARK ALL AS READ
// ========================================

if (markAllReadButton) {
  markAllReadButton.addEventListener("click", async () => {
    try {
      markAllReadButton.disabled = true;

      const { error } = await window.lightSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", currentUserId)
        .eq("is_read", false);

      if (error) throw error;

      notifications.forEach(notification => {
        notification.is_read = true;
      });

      renderNotifications();

    } catch (error) {
      console.error("Mark all as read failed:", error);
      alert("Could not update notifications. Please try again.");

    } finally {
      markAllReadButton.disabled = false;
    }
  });
}

// ========================================
// NOTIFICATION FILTER TABS
// ========================================

notificationTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    notificationTabs.forEach(item => {
      item.classList.remove("active");
    });

    tab.classList.add("active");

    activeFilter = tab.dataset.filter;

    renderNotifications();
  });
});

// ========================================
// START NOTIFICATIONS
// ========================================

loadNotifications();
