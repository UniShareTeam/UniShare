import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResourceCard from "@/components/resource-card";
import StudyGroupCard from "@/components/study-group-card";

export default async function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient();

  // Check if user is logged in
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If logged in, redirect to dashboard public profile
  if (session) {
    redirect(`/dashboard/public-profile/${params.username}`);
  }

  // Fetch the public profile data
  // Clean the username parameter (remove @ if present and trim whitespace)
  const cleanUsername = params.username.startsWith("@")
    ? params.username.substring(1).trim()
    : params.username.trim();

  // First try exact match
  const { data: profileData, error: exactMatchError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("username", cleanUsername)
    .maybeSingle();

  // If not found with exact match, try case-insensitive search
  let finalProfileData = profileData;

  if (!finalProfileData) {
    const { data: caseInsensitiveData } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("username", cleanUsername)
      .maybeSingle();

    finalProfileData = caseInsensitiveData;
  }

  if (!finalProfileData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-6">User Not Found</h1>
        <p>The profile you're looking for doesn't exist or is not public.</p>
      </div>
    );
  }

  // Fetch public resources by this user
  const { data: resources = [], error: resourcesError } = await supabase
    .from("resources")
    .select("*")
    .eq("author_id", finalProfileData.id)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(3);

  // Fetch public study groups by this user
  const { data: studyGroups = [], error: studyGroupsError } = await supabase
    .from("study_groups")
    .select("*")
    .eq("created_by", finalProfileData.id)
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
          <Avatar className="w-24 h-24 border-2 border-primary">
            <AvatarImage
              src={finalProfileData.avatar_url || undefined}
              alt={finalProfileData.full_name || finalProfileData.username}
            />
            <AvatarFallback className="text-2xl">
              {(finalProfileData.full_name || finalProfileData.username || "")
                .substring(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold">
              {finalProfileData.full_name || finalProfileData.username}
            </h1>
            <p className="text-muted-foreground mb-2">
              @{finalProfileData.username}
            </p>
            {finalProfileData.university && (
              <p className="text-sm mb-2">
                <span className="font-medium">University:</span>{" "}
                {finalProfileData.university}
              </p>
            )}
            {finalProfileData.major && (
              <p className="text-sm mb-2">
                <span className="font-medium">Major:</span>{" "}
                {finalProfileData.major}
              </p>
            )}
            {finalProfileData.bio && (
              <p className="mt-3 text-sm">{finalProfileData.bio}</p>
            )}
          </div>
        </div>

        {/* Tabs for Resources and Study Groups */}
        <Tabs defaultValue="resources" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="studyGroups">Study Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="resources" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Public Resources</h2>
            {resources && resources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">
                    No public resources available
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to see more resources and interact with this profile
              </p>
            </div>
          </TabsContent>

          <TabsContent value="studyGroups" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Public Study Groups</h2>
            {studyGroups && studyGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studyGroups.map((group) => (
                  <StudyGroupCard key={group.id} group={group} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">
                    No public study groups available
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to join study groups and collaborate with this user
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
