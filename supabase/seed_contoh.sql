-- OPSIONAL: data contoh untuk uji coba kelas 9A. Ganti PIN sebelum dipakai di kelas.
insert into public.groups (class_name, group_name, project_title, pin) values
  ('9A', 'Kelompok 1', 'Smart Trash Bin IoT',            '1111'),
  ('9A', 'Kelompok 2', 'Penyiram Tanaman Otomatis',      '2222'),
  ('9A', 'Kelompok 3', 'Detektor Banjir Dini',           '3333'),
  ('9A', 'Kelompok 4', 'Smart Parking Sekolah',          '4444'),
  ('9A', 'Kelompok 5', 'Monitor Kualitas Udara Kelas',   '5555')
on conflict (class_name, group_name) do nothing;
