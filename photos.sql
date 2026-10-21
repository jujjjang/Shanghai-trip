-- 상하이 여행 앱 · 사진도 친구랑 같이 보기
-- supabase.sql 다음에 SQL Editor에서 한 번만 Run. (다시 돌려도 괜찮아요)
-- 사진은 여행 코드 폴더 아래에 올라가고, 사진 주소(여행 코드 + 사진 id)를 아는 사람만 볼 수 있어요.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "trip photos upload" on storage.objects;
create policy "trip photos upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'trip-photos' and length((storage.foldername(name))[1]) >= 10);
