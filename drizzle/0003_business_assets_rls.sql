-- business_assets: logos and app icons. RLS is on with no policies and no
-- grants for ptforge_app, so the app role can't read or write it at all.
-- Settings (admin-checked) and the public /brand route use the owner connection.
ALTER TABLE "business_assets" ENABLE ROW LEVEL SECURITY;
