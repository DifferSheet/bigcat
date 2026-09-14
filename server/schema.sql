-- BIGCAT event system schema (MySQL 8+)

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  type ENUM('fanmeet','merit','busking','workshop','popup') NOT NULL,
  status ENUM('upcoming','open','soldout','live','ended') NOT NULL DEFAULT 'upcoming',
  category VARCHAR(60) NOT NULL,
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(200) NULL,
  description TEXT NULL,
  place VARCHAR(200) NULL,
  map_url VARCHAR(400) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  cover VARCHAR(300) NULL,
  tone VARCHAR(20) NOT NULL DEFAULT 'pink',
  config JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  label VARCHAR(8) NOT NULL,
  row_label VARCHAR(4) NOT NULL,
  col_num INT NOT NULL,
  zone VARCHAR(40) NOT NULL DEFAULT 'standard',
  price INT NOT NULL DEFAULT 0,
  status ENUM('available','held','booked') NOT NULL DEFAULT 'available',
  hold_token VARCHAR(64) NULL,
  hold_expires_at DATETIME NULL,
  booking_id INT NULL,
  UNIQUE KEY uq_seat (event_id, label),
  KEY idx_hold (hold_token),
  CONSTRAINT fk_seat_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  event_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160) NULL,
  seats JSON NOT NULL,
  amount INT NOT NULL,
  slip_path VARCHAR(300) NULL,
  trans_ref VARCHAR(64) NULL,
  verified_at DATETIME NULL,
  verify_note VARCHAR(300) NULL,
  line_user_id VARCHAR(64) NULL,
  status ENUM('pending','paid','rejected','checked_in') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bk_ref (trans_ref),
  CONSTRAINT fk_booking_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS donation_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(300) NULL,
  goal INT NOT NULL,
  unit_name VARCHAR(40) NULL,
  unit_price INT NULL,
  sort INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_cat_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  event_id INT NOT NULL,
  category_id INT NOT NULL,
  donor_name VARCHAR(120) NOT NULL,
  dedication VARCHAR(160) NULL,
  message VARCHAR(300) NULL,
  anonymous TINYINT(1) NOT NULL DEFAULT 0,
  amount INT NOT NULL,
  units INT NULL,
  slip_path VARCHAR(300) NULL,
  trans_ref VARCHAR(64) NULL,
  verified_at DATETIME NULL,
  verify_note VARCHAR(300) NULL,
  line_user_id VARCHAR(64) NULL,
  thanked_at DATETIME NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_don_ref (trans_ref),
  CONSTRAINT fk_don_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_don_cat FOREIGN KEY (category_id) REFERENCES donation_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  event_id INT NOT NULL,
  number INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  nickname VARCHAR(60) NULL,
  social VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'attend',
  line_user_id VARCHAR(64) NULL,
  checked_in_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reg_number (event_id, number),
  CONSTRAINT fk_reg_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lucky_draws (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  round INT NOT NULL,
  registration_id INT NOT NULL,
  drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_draw_round (event_id, round),
  CONSTRAINT fk_draw_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_draw_reg FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS song_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  artist VARCHAR(120) NULL,
  votes INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_song_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- รายงานความโปร่งใสหลังจบงาน (ใบเสร็จ / ภาพส่งมอบ / บันทึก)
CREATE TABLE IF NOT EXISTS report_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  kind ENUM('receipt','photo','note') NOT NULL DEFAULT 'receipt',
  title VARCHAR(200) NOT NULL,
  amount INT NULL,
  image_path VARCHAR(300) NULL,
  body TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- โหวตใน milestone แบบ poll (1 เสียงต่อเบราว์เซอร์)
CREATE TABLE IF NOT EXISTS poll_votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  poll_key VARCHAR(60) NOT NULL,
  option_index INT NOT NULL,
  voter_token VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vote (event_id, poll_key, voter_token),
  CONSTRAINT fk_poll_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ---------- ร้านค้า ----------
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  name_th VARCHAR(160) NULL,
  description TEXT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'ของสะสม',
  price INT NOT NULL,
  compare_price INT NULL,
  image VARCHAR(300) NULL,
  images JSON NULL,
  stock INT NOT NULL DEFAULT 0,
  status ENUM('active','hidden','soldout') NOT NULL DEFAULT 'active',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตัวเลือกสินค้า (ไซส์/สี) — ถ้ามี variant สต็อกนับที่ variant
CREATE TABLE IF NOT EXISTS product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  price_delta INT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  sku VARCHAR(60) NULL,
  sort INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_var_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  status ENUM('pending','paid','packing','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160) NULL,
  delivery ENUM('ship','pickup') NOT NULL DEFAULT 'ship',
  address TEXT NULL,
  note VARCHAR(300) NULL,
  subtotal INT NOT NULL,
  shipping_fee INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  slip_path VARCHAR(300) NULL,
  trans_ref VARCHAR(64) NULL,
  verified_at DATETIME NULL,
  verify_note VARCHAR(300) NULL,
  carrier VARCHAR(60) NULL,
  tracking_no VARCHAR(80) NULL,
  line_user_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_ref (trans_ref)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NULL,
  variant_id INT NULL,
  name VARCHAR(200) NOT NULL,
  variant_name VARCHAR(80) NULL,
  image VARCHAR(300) NULL,
  price INT NOT NULL,
  qty INT NOT NULL,
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ค่าตั้งค่าร้าน (ค่าส่ง, รับหน้างาน, ช่องทางชำระเงิน) เก็บเป็น JSON
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(60) PRIMARY KEY,
  value JSON NOT NULL
);
