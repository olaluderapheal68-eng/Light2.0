const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// SUPABASE CONNECTION
// ==========================================

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

app.use(cors());
app.use(express.json());

// ==========================================
// AUTHENTICATION
// ==========================================

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Unable to authenticate user",
    });
  }
};

const getUserSupabase = (accessToken) => {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
};

// ==========================================
// CREATE NOTIFICATION
// ==========================================

async function createNotification({
  recipientId,
  actorId,
  type,
  postId = null,
  message,
}) {
  if (!recipientId || recipientId === actorId) return;

  const { error } = await supabase
    .from("notifications")
    .insert({
      recipient_id: recipientId,
      actor_id: actorId,
      notification_type: type,
      post_id: postId,
      message,
      is_read: false,
    });

  if (error) {
    console.error("Notification creation failed:", error.message);
  }
}

// ==========================================
// HOME AND HEALTH
// ==========================================

app.get("/", (req, res) => {
  res.json({
    name: "Light",
    message: "Welcome to the Light API!",
    status: "running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Light backend is healthy",
  });
});

// ==========================================
// POSTS
// ==========================================

// GET TOP-LEVEL POSTS
app.get("/api/posts", requireAuth, async (req, res) => {
  try {
    const userSupabase = getUserSupabase(req.accessToken);

    const { data, error } = await userSupabase
      .from("posts")
      .select("*")
      .is("reply_to_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch posts error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to fetch posts",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Unexpected fetch posts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch posts",
    });
  }
});

// CREATE A POST OR REPLY
app.post("/api/posts", requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    const rawReplyId = req.body.reply_to_id;

    // posts.id is int8 in the database.
    const reply_to_id =
      rawReplyId === undefined || rawReplyId === null || rawReplyId === ""
        ? null
        : Number(rawReplyId);

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Post content is required",
      });
    }

    if (
      reply_to_id !== null &&
      (!Number.isSafeInteger(reply_to_id) || reply_to_id <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid original post ID",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);
    let originalPost = null;

    // Verify original post before creating a reply.
    if (reply_to_id !== null) {
      const { data, error: parentError } = await userSupabase
        .from("posts")
        .select("id, user_id")
        .eq("id", reply_to_id)
        .maybeSingle();

      if (parentError || !data) {
        console.error("Original post lookup error:", parentError?.message);

        return res.status(404).json({
          success: false,
          message: "Original post not found or unavailable",
        });
      }

      originalPost = data;
    }

    const { data, error } = await userSupabase
      .from("posts")
      .insert({
        content: content.trim(),
        user_id: req.user.id,
        reply_to_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Create post error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to create post",
      });
    }

    // Notify the author of the original post.
    if (originalPost) {
      await createNotification({
        recipientId: originalPost.user_id,
        actorId: req.user.id,
        type: "reply",
        postId: data.id,
        message: "Someone replied to your post.",
      });
    }

    return res.status(201).json({
      success: true,
      message: reply_to_id !== null
        ? "Reply created successfully"
        : "Post created successfully",
      data,
    });
  } catch (error) {
    console.error("Unexpected create post error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create post",
    });
  }
});

// ==========================================
// FOLLOW REQUESTS
// ==========================================

app.post("/api/follows/:id/respond", requireAuth, async (req, res) => {
  try {
    const followId = Number(req.params.id);
    const { accept } = req.body;

    if (!Number.isSafeInteger(followId) || followId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid follow request ID",
      });
    }

    if (typeof accept !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "The accept field must be true or false",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);

    const { data, error } = await userSupabase.rpc(
      "respond_to_follow_request",
      {
        p_follow_id: followId,
        p_accept: accept,
      }
    );

    if (error) {
      console.error("Follow request response error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to respond to follow request",
      });
    }

    if (data !== true) {
      return res.status(404).json({
        success: false,
        message: "Pending follow request not found",
      });
    }

    return res.json({
      success: true,
      message: accept
        ? "Follow request accepted"
        : "Follow request rejected",
    });
  } catch (error) {
    console.error("Unexpected follow request error:", error.message);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
    });
  }
});

// ==========================================
// POST LIKES
// ==========================================

// GET LIKES FOR A POST
app.get("/api/posts/:id/likes", requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isSafeInteger(postId) || postId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);

    const { data, error } = await userSupabase
      .from("post_likes")
      .select("user_id")
      .eq("post_id", postId);

    if (error) {
      console.error("Fetch likes error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to fetch likes",
      });
    }

    return res.json({
      success: true,
      count: data.length,
      likedByMe: data.some(
        (like) => like.user_id === req.user.id
      ),
    });
  } catch (error) {
    console.error("Unexpected likes error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch likes",
    });
  }
});

// LIKE A POST AND NOTIFY ITS AUTHOR
app.post("/api/posts/:id/likes", requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isSafeInteger(postId) || postId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);

    const { data: post, error: postError } = await userSupabase
      .from("posts")
      .select("id, user_id")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !post) {
      console.error("Like post lookup error:", postError?.message);

      return res.status(404).json({
        success: false,
        message: "Post not found or unavailable",
      });
    }

    const { error } = await userSupabase
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: req.user.id,
      });

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "You have already liked this post",
        });
      }

      console.error("Like post error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to like post",
      });
    }

    await createNotification({
      recipientId: post.user_id,
      actorId: req.user.id,
      type: "like",
      postId,
      message: "Someone liked your post.",
    });

    return res.status(201).json({
      success: true,
      message: "Post liked",
    });
  } catch (error) {
    console.error("Unexpected like error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to like post",
    });
  }
});

// UNLIKE A POST
app.delete("/api/posts/:id/likes", requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isSafeInteger(postId) || postId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);

    const { error } = await userSupabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", req.user.id);

    if (error) {
      console.error("Unlike post error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to unlike post",
      });
    }

    return res.json({
      success: true,
      message: "Post unliked",
    });
  } catch (error) {
    console.error("Unexpected unlike error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to unlike post",
    });
  }
});

// ==========================================
// POST THREADS
// ==========================================

app.get("/api/posts/:id/thread", requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isSafeInteger(postId) || postId <= 0) {
      return res.status(400).json({
        error: "Invalid post ID.",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);

    const { data: original, error: originalError } = await userSupabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();

    if (originalError) {
      return res.status(500).json({
        error: originalError.message,
      });
    }

    if (!original) {
      return res.status(404).json({
        error: "Post not found or unavailable.",
      });
    }

    const { data: replies, error: repliesError } = await userSupabase
      .from("posts")
      .select("*")
      .eq("reply_to_id", postId)
      .order("created_at", { ascending: true });

    if (repliesError) {
      return res.status(500).json({
        error: repliesError.message,
      });
    }

    return res.json({
      data: {
        original,
        replies: replies || [],
      },
    });
  } catch (error) {
    console.error("Thread loading error:", error.message);

    return res.status(500).json({
      error: "Could not load conversation.",
    });
  }
});

// ==========================================
// COMMUNITIES
// ==========================================

// GET COMMUNITIES
app.get("/api/communities", requireAuth, async (req, res) => {
  try {
    const userSupabase = getUserSupabase(req.accessToken);

    const { data: communities, error } = await userSupabase
      .from("communities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    const { data: memberships, error: membershipError } =
      await userSupabase
        .from("community_members")
        .select("id, community_id, user_id, status, role");

    if (membershipError) {
      return res.status(400).json({
        error: membershipError.message,
      });
    }

    const result = (communities || []).map((community) => {
      const communityMemberships = (memberships || []).filter(
        (item) => item.community_id === community.id
      );

      const membership = communityMemberships.find(
        (item) => item.user_id === req.user.id
      );

      const isCreator = community.created_by === req.user.id;

      const pendingRequests = isCreator
        ? communityMemberships
            .filter((item) => item.status === "pending")
            .map((item) => ({
              membership_id: item.id,
              user_id: item.user_id,
              status: item.status,
            }))
        : [];

      return {
        ...community,
        is_member: isCreator || membership?.status === "approved",
        is_pending: membership?.status === "pending",
        member_role: isCreator ? "admin" : membership?.role || null,
        pending_requests: pendingRequests,
      };
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error("Loading communities failed:", error);

    return res.status(500).json({
      error: "Could not load communities.",
    });
  }
});

// CREATE COMMUNITY
app.post("/api/communities", requireAuth, async (req, res) => {
  try {
    const { name, description, category, privacy } = req.body;

    if (
      !name?.trim() ||
      !description?.trim() ||
      !category?.trim() ||
      !["public", "private"].includes(privacy)
    ) {
      return res.status(400).json({
        error: "Please provide a valid name, description, category and privacy.",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);

    const { data, error } = await userSupabase
      .from("communities")
      .insert({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        privacy,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(201).json({
      message: "Community created successfully.",
      data: {
        ...data,
        is_member: true,
        is_pending: false,
        member_role: "admin",
      },
    });
  } catch (error) {
    console.error("Creating community failed:", error);

    return res.status(500).json({
      error: "Could not create community.",
    });
  }
});

// JOIN OR REQUEST TO JOIN COMMUNITY
app.post("/api/communities/:id/join", requireAuth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);

    if (!Number.isSafeInteger(communityId) || communityId <= 0) {
      return res.status(400).json({
        error: "Invalid community ID.",
      });
    }

    const userSupabase = getUserSupabase(req.accessToken);

    const { data: community, error: communityError } = await userSupabase
      .from("communities")
      .select("id, privacy, created_by")
      .eq("id", communityId)
      .maybeSingle();

    // Private communities may be hidden by RLS.
    if (communityError || !community) {
      const { data: status, error: requestError } =
        await userSupabase.rpc("request_private_community_join", {
          p_community_id: communityId,
        });

      if (requestError) {
        console.error("Private community request failed:", requestError);

        return res.status(400).json({
          error: requestError.message,
        });
      }

      return res.status(200).json({
        message: status === "pending"
          ? "Your request has been submitted or is already pending."
          : status === "approved"
            ? "You are already a member of this community."
            : "Community request processed.",
        status,
      });
    }

    if (community.created_by === req.user.id) {
      return res.json({
        message: "You created this community.",
      });
    }

    if (community.privacy === "private") {
      const { data: status, error: requestError } =
        await userSupabase.rpc("request_private_community_join", {
          p_community_id: communityId,
        });

      if (requestError) {
        return res.status(400).json({
          error: requestError.message,
        });
      }

      return res.status(200).json({
        message: "Your request has been submitted or is already pending.",
        status,
      });
    }

    const { data: existing, error: existingError } = await userSupabase
      .from("community_members")
      .select("id, status")
      .eq("community_id", communityId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (existingError) {
      return res.status(400).json({
        error: existingError.message,
      });
    }

    if (existing) {
      return res.status(409).json({
        error: existing.status === "pending"
          ? "Your request is already pending."
          : "You have already joined this community.",
      });
    }

    const { data, error } = await userSupabase
      .from("community_members")
      .insert({
        community_id: communityId,
        user_id: req.user.id,
        role: "member",
        status: "approved",
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(201).json({
      message: "You joined the community successfully.",
      data,
    });
  } catch (error) {
    console.error("Joining community failed:", error);

    return res.status(500).json({
      error: "Could not join community.",
    });
  }
});

// RESPOND TO COMMUNITY REQUEST
app.post(
  "/api/communities/requests/:membershipId/respond",
  requireAuth,
  async (req, res) => {
    try {
      const membershipId = Number(req.params.membershipId);
      const { approve } = req.body;

      if (!Number.isSafeInteger(membershipId) || membershipId <= 0) {
        return res.status(400).json({
          error: "Invalid membership ID.",
        });
      }

      if (typeof approve !== "boolean") {
        return res.status(400).json({
          error: "Approve must be true or false.",
        });
      }

      const userSupabase = getUserSupabase(req.accessToken);

      const { data, error } = await userSupabase.rpc(
        "respond_to_community_request",
        {
          p_membership_id: membershipId,
          p_approve: approve,
        }
      );

      if (error) {
        return res.status(400).json({
          error: error.message,
        });
      }

      return res.json({
        message: approve
          ? "Membership request approved."
          : "Membership request rejected.",
        status: data,
      });
    } catch (error) {
      console.error("Community request response failed:", error);

      return res.status(500).json({
        error: "Could not process community request.",
      });
    }
  }
);

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`Light API running at http://localhost:${PORT}`);
});