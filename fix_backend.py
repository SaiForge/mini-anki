import os
import re

def process_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
        
    with open(filepath, 'w') as f:
        f.write(content)

replacements = [
    (r'".*profile_picture_url.*",?\n', ''),
    (r'current_user\.profile_picture_url\s*=\s*public_url', 'pass'),
    (r'"avatar_url":\s*u\.profile_picture_url', '"avatar_url": None'),
    (r'author\.profile_picture_url\s*if\s*author\s*else\s*None', 'None'),
    (r'c\.author\.profile_picture_url\s*if\s*c\.author\s*else\s*None', 'None'),
    (r'profile_picture_url=user\.profile_picture_url,?', ''),
    (r'if user_update\.profile_picture_url is not None:.*?current_user\.profile_picture_url = user_update\.profile_picture_url', ''),
    (r'"profile_picture_url":\s*db_user\.profile_picture_url,?', ''),
    (r'm\.sender\.profile_picture_url\s*if\s*m\.sender\s*else\s*None', 'None'),
    (r'partner\.profile_picture_url\s*if\s*partner\s*else\s*None', 'None'),
    (r'n\.actor\.profile_picture_url', 'None'),
    (r'deck\.owner\.profile_picture_url\s*if\s*deck\.owner\s*else\s*None', 'None'),
    (r'u\.profile_picture_url', 'None')
]

files_to_fix = [
    'backend/app/main.py',
    'backend/app/api/upload_router.py',
    'backend/app/api/social_router.py',
    'backend/app/api/analytics_router.py',
    'backend/app/api/feed_router.py',
    'backend/app/api/auth_router.py',
    'backend/app/api/dm_router.py',
    'backend/app/api/notification_router.py',
    'backend/app/api/explore_router.py'
]

for f in files_to_fix:
    process_file(f, replacements)
    print(f"Processed {f}")

