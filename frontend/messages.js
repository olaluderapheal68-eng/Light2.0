
// ========================================
// LIGHT MESSAGES
// ========================================

let currentUser = null;
let conversations = [];
let activeConversationId = null;

// Page elements
const conversationList = document.getElementById("conversationList");
const conversationSearch = document.getElementById("conversationSearch");
const chatEmptyState = document.getElementById("chatEmptyState");
const chatContent = document.getElementById("chatContent");
const chatHeader = document.getElementById("chatHeader");
const messageList = document.getElementById("messageList");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const newMessageBtn = document.getElementById("newMessageBtn");

// ========================================
// HELPER FUNCTIONS
// ========================================

function getConversationName(conversation) {
  if (conversation.is_group) {
    return conversation.title || "Group conversation";
  }

  const fullName = [
    conversation.first_name,
    conversation.last_name
  ].filter(Boolean).join(" ");

  return fullName || conversation.username || "Light user";
}

function getConversationUsername(conversation) {
  return conversation.username
    ? `@${conversation.username}`
    : "";
}

// ========================================
// INITIALIZE
// ========================================

async function initializeMessages() {
  if (!window.lightSupabase) {
    console.error("Light Supabase client not found.");
    return;
  }

  const { data, error } = await window.lightSupabase.auth.getUser();

  if (error || !data.user) {
    console.error("Unable to get authenticated user:", error);
    return;
  }

  currentUser = data.user;

  await loadConversations();
}

// ========================================
// LOAD CONVERSATIONS
// ========================================

async function loadConversations() {
  conversationList.innerHTML =
    '<p class="empty-state">Loading conversations...</p>';

  const { data, error } = await window.lightSupabase
    .rpc("get_my_conversations");

  if (error) {
    console.error("Conversation loading failed:", error);

    conversationList.innerHTML =
      '<p class="empty-state">Could not load conversations.</p>';

    return;
  }

  conversations = data || [];

  if (conversations.length === 0) {
    conversationList.innerHTML =
      '<p class="empty-state">No conversations yet.</p>';

    activeConversationId = null;
    chatContent.hidden = true;
    chatEmptyState.hidden = false;
    return;
  }

  // Keep the active conversation selected if it still exists.
  const activeConversation = conversations.find(
    conversation =>
      String(conversation.conversation_id) ===
      String(activeConversationId)
  );

  if (!activeConversation) {
    activeConversationId = null;
    chatContent.hidden = true;
    chatEmptyState.hidden = false;
  }

  renderConversations(conversationSearch.value);
}

// ========================================
// DISPLAY CONVERSATIONS
// ========================================

function renderConversations(filter = "") {
  conversationList.innerHTML = "";

  const searchTerm = filter.toLowerCase().trim();

  const filtered = conversations.filter(conversation => {
    const name = getConversationName(conversation);
    const username = conversation.username || "";
    const title = conversation.title || "";

    return `${name} ${username} ${title}`
      .toLowerCase()
      .includes(searchTerm);
  });

  if (filtered.length === 0) {
    conversationList.innerHTML =
      '<p class="empty-state">No matching conversations.</p>';
    return;
  }

  filtered.forEach(conversation => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "conversation-item";

    if (
      String(conversation.conversation_id) ===
      String(activeConversationId)
    ) {
      item.classList.add("selected");
    }

    // Profile avatar
    const avatar = document.createElement("div");
    avatar.className = "conversation-avatar";

    if (conversation.avatar_url) {
      const image = document.createElement("img");
      image.src = conversation.avatar_url;
      image.alt = getConversationName(conversation);
      image.onerror = () => {
        image.remove();
        avatar.textContent =
          getConversationName(conversation).charAt(0).toUpperCase();
      };
      avatar.appendChild(image);
    } else {
      avatar.textContent =
        getConversationName(conversation).charAt(0).toUpperCase();
    }

    // Conversation details
    const details = document.createElement("div");
    details.className = "conversation-details";

    const name = document.createElement("strong");
    name.className = "conversation-name";
    name.textContent = getConversationName(conversation);

    const username = document.createElement("small");
    username.className = "conversation-username";
    username.textContent = getConversationUsername(conversation);

    details.appendChild(name);

    if (username.textContent) {
      details.appendChild(username);
    }

    item.appendChild(avatar);
    item.appendChild(details);

    item.addEventListener("click", () => {
      openConversation(conversation);
    });

    conversationList.appendChild(item);
  });
}

// ========================================
// OPEN CONVERSATION
// ========================================

async function openConversation(conversation) {
  activeConversationId = conversation.conversation_id;

  chatEmptyState.hidden = true;
  chatContent.hidden = false;

  chatHeader.textContent = getConversationName(conversation);

  renderConversations(conversationSearch.value);

  await loadMessages();
}

// ========================================
// LOAD MESSAGES
// ========================================

async function loadMessages() {
  if (!activeConversationId) return;

  messageList.innerHTML =
    '<p class="empty-state">Loading messages...</p>';

  const { data, error } = await window.lightSupabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, content, attachment_url, message_type, created_at, is_edited"
    )
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Message loading failed:", error);

    messageList.innerHTML =
      '<p class="empty-state">Could not load messages.</p>';

    return;
  }

  renderMessages(data || []);
}

// ========================================
// DISPLAY MESSAGES
// ========================================

function renderMessages(messages) {
  messageList.innerHTML = "";

  if (messages.length === 0) {
    messageList.innerHTML =
      '<p class="empty-state">No messages yet. Start the conversation.</p>';
    return;
  }

  messages.forEach(message => {
    const bubble = document.createElement("div");

    bubble.className =
      message.sender_id === currentUser.id
        ? "message-bubble own-message"
        : "message-bubble other-message";

    const content = document.createElement("p");
    content.textContent = message.content || "";

    const time = document.createElement("small");
    time.textContent = new Date(message.created_at).toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    );

    bubble.appendChild(content);
    bubble.appendChild(time);

    if (message.is_edited) {
      const edited = document.createElement("small");
      edited.textContent = " Edited";
      bubble.appendChild(edited);
    }

    messageList.appendChild(bubble);
  });

  messageList.scrollTop = messageList.scrollHeight;
}

// ========================================
// SEND MESSAGE
// ========================================

messageForm.addEventListener("submit", async event => {
  event.preventDefault();

  const content = messageInput.value.trim();

  if (!content || !activeConversationId || !currentUser) return;

  const submitButton = messageForm.querySelector("button");

  if (submitButton) {
    submitButton.disabled = true;
  }

  const { error } = await window.lightSupabase
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      sender_id: currentUser.id,
      content,
      message_type: "text"
    });

  if (submitButton) {
    submitButton.disabled = false;
  }

  if (error) {
    console.error("Message sending failed:", error);
    alert("Message could not be sent: " + error.message);
    return;
  }

  messageInput.value = "";

  await loadMessages();
});

// ========================================
// SEARCH CONVERSATIONS
// ========================================

conversationSearch.addEventListener("input", event => {
  renderConversations(event.target.value);
});

// ========================================
// NEW MESSAGE
// ========================================

newMessageBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Please wait. Your account is still loading.");
    return;
  }

  const username = prompt(
    "Enter the username of the person you want to message:"
  );

  if (!username || !username.trim()) return;

  const cleanUsername = username.trim().replace(/^@/, "");

  const { data: users, error: searchError } =
    await window.lightSupabase
      .from("public_profiles")
      .select("id, username, first_name, last_name")
      .eq("username", cleanUsername)
      .limit(1);

  if (searchError) {
    console.error("User search failed:", searchError);
    alert("Could not search for this user: " + searchError.message);
    return;
  }

  if (!users || users.length === 0) {
    alert("User not found. Check the username and try again.");
    return;
  }

  const selectedUser = users[0];

  if (selectedUser.id === currentUser.id) {
    alert("You cannot start a conversation with yourself.");
    return;
  }

  const { data: conversationId, error: createError } =
    await window.lightSupabase.rpc("create_direct_conversation", {
      target_user_id: selectedUser.id
    });

  if (createError) {
    console.error("Conversation creation failed:", createError);
    alert("Could not create conversation: " + createError.message);
    return;
  }

  await loadConversations();

  const conversation = conversations.find(
    item =>
      String(item.conversation_id) === String(conversationId)
  );

  if (conversation) {
    await openConversation(conversation);
  } else {
    alert(
      "Conversation was created, but could not be loaded. Check the Console."
    );
  }
});

// ========================================
// START
// ========================================

initializeMessages();
