
async function protectHomePage() {
  const supabaseClient = window.lightSupabase;

  if (!supabaseClient) {
    window.location.replace("index.html");
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.replace("index.html");
    return;
  }

  console.log("Light user authenticated:", data.session.user.email);
}

protectHomePage();
