const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://ydoaaajqtgdzzkszpees.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb2FhYWpxdGdkenprc3pwZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjA1NjAsImV4cCI6MjEwNDgzNjU2MH0.0JgN57mw_vz8JmdxxjGosCDEOkAKPYmpBgfET0FIilw";

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDatabase() {
  try {
    console.log("🗑️ Fetching all profiles...");

    // Get all profiles
    const { data: profiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id");

    if (fetchError) {
      console.error("❌ Fetch error:", fetchError.message);
      process.exit(1);
    }

    if (!profiles || profiles.length === 0) {
      console.log("✅ No profiles to delete");
      process.exit(0);
    }

    console.log(`Found ${profiles.length} profile(s). Deleting...`);

    // Delete each profile
    for (const profile of profiles) {
      const { error: deleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profile.id);

      if (deleteError) {
        console.error(`❌ Error deleting profile ${profile.id}:`, deleteError.message);
      } else {
        console.log(`✅ Deleted profile: ${profile.id}`);
      }
    }

    console.log("\n🎉 All profiles deleted successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  }
}

cleanDatabase();
