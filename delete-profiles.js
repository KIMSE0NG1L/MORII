const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://ydoaaajqtgdzzkszpees.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb2FhYWpxdGdkenprc3pwZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjA1NjAsImV4cCI6MjEwNDgzNjU2MH0.0JgN57mw_vz8JmdxxjGosCDEOkAKPYmpBgfET0FIilw";

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllProfiles() {
  try {
    console.log("🗑️ Deleting all profiles from database...");

    const { error } = await supabase.from("profiles").delete().neq("id", "");

    if (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }

    console.log("✅ All profiles deleted successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  }
}

deleteAllProfiles();
