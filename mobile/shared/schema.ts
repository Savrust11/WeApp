import { pgTable, text, serial, integer, boolean, timestamp, date, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  pictureUrl: text("picture_url"),
  familyId: text("family_id").notNull(),
  role: text("role").notNull().default("papa"),
  invitationVerified: boolean("invitation_verified").notNull().default(false),
  pushToken: text("push_token"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invitationCodes = pgTable("invitation_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  familyId: text("family_id"),
  isUsed: boolean("is_used").notNull().default(false),
  usedBy: text("used_by"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type AppUser = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  name: text("name").notNull(),
  birthday: date("birthday"),
  gender: text("gender"),
  bloodType: text("blood_type"),
  color: text("color").notNull().default("#805AAA"),
  sleepTrainingEnabled: boolean("sleep_training_enabled").notNull().default(true),
  rotavirusVaccineType: text("rotavirus_vaccine_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  points: integer("points").notNull().default(10),
  message: text("message"),
  subType: text("sub_type"),
  foodItems: text("food_items"),
  foodAmount: text("food_amount"),
  isNewFood: boolean("is_new_food").default(false),
  imageUrl: text("image_url"),
  poopColor: text("poop_color"),
  poopConsistency: text("poop_consistency"),
  bodyTemperature: real("body_temperature"),
  symptoms: text("symptoms"),
  symptomNote: text("symptom_note"),
  breastLeftMin: integer("breast_left_min"),
  breastRightMin: integer("breast_right_min"),
  isExpressed: boolean("is_expressed").default(false),
  expressedMl: integer("expressed_ml"),
  formulaMl: integer("formula_ml"),
  stoolType: text("stool_type"),
  stoolAmount: text("stool_amount"),
  stoolColor: text("stool_color"),
  medicineName: text("medicine_name"),
  medicineDose: text("medicine_dose"),
  performedBy: text("performed_by"),
  spitUp: boolean("spit_up").default(false),
  spitUpAmount: text("spit_up_amount"),
  spitUpTiming: text("spit_up_timing"),
  spitUpNote: text("spit_up_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().unique(),
  babyName: text("baby_name").notNull().default("赤ちゃんのなまえ"),
  babyBirthday: date("baby_birthday"),
  specialTrick: text("special_trick").default("ビニール袋の音"),
  currentCaregiver: text("current_caregiver").notNull().default("パパ"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  title: text("title").notNull(),
  date: date("date").notNull(),
  time: text("time"),
  assignee: text("assignee").notNull().default("未定"),
  completed: boolean("completed").notNull().default(false),
  completedBy: text("completed_by"),
  points: integer("points").notNull().default(10),
  memo: text("memo"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  title: text("title").notNull(),
  cost: integer("cost").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userCoupons = pgTable("user_coupons", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  couponId: integer("coupon_id").notNull(),
  couponTitle: text("coupon_title").notNull(),
  cost: integer("cost").notNull(),
  ownerId: text("owner_id").notNull(),
  status: text("status").notNull().default("owned"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  targetUser: text("target_user").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("coupon"),
  read: boolean("read").notNull().default(false),
  childId: integer("child_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const growthRecords = pgTable("growth_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  userId: text("user_id").notNull(),
  weightGrams: integer("weight_grams"),
  heightCm: real("height_cm"),
  headCircumferenceCm: real("head_circumference_cm"),
  measuredAt: date("measured_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChildSchema = createInsertSchema(children).omit({ id: true, createdAt: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true });
export const insertUserCouponSchema = createInsertSchema(userCoupons).omit({ id: true, createdAt: true, usedAt: true });
export const insertGrowthRecordSchema = createInsertSchema(growthRecords).omit({ id: true, createdAt: true });

export const sleepChecklist = pgTable("sleep_checklist", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  date: date("date").notNull(),
  darkness: boolean("darkness").notNull().default(false),
  temperature: boolean("temperature").notNull().default(false),
  safety: boolean("safety").notNull().default(false),
  whiteNoise: boolean("white_noise").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sleepRoutines = pgTable("sleep_routines", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  title: text("title").notNull(),
  assignee: text("assignee").notNull().default("未定"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sleepRoutineLogs = pgTable("sleep_routine_logs", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  routineId: integer("routine_id").notNull(),
  date: date("date").notNull(),
  completedBy: text("completed_by").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const sleepSessions = pgTable("sleep_sessions", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  durationMin: integer("duration_min"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skillCompletions = pgTable("skill_completions", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  userId: text("user_id").notNull(),
  skillId: text("skill_id").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── ママのからだ記録 ────────────────────────────────────────────────────────

export const mamaHealthRecords = pgTable("mama_health_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  userId: text("user_id").notNull(),
  recordedDate: text("recorded_date").notNull(), // YYYY-MM-DD
  bowelMovement: boolean("bowel_movement"),       // お通じ あり/なし
  bowelNote: text("bowel_note"),                  // お通じメモ
  lochiaState: text("lochia_state"),              // 悪露: none/light/medium/heavy
  perineumPain: integer("perineum_pain"),         // 会陰の痛み 0-4
  mood: integer("mood"),                          // 気分 0-4
  sleepHours: integer("sleep_hours"),             // 睡眠時間(時)
  sleepMinutes: integer("sleep_minutes"),         // 睡眠時間(分)
  breastfeedingTrouble: text("breastfeeding_trouble"), // 授乳トラブル comma-separated
  weightKg: text("weight_kg"),                    // 体重 kg
  hasEdema: boolean("has_edema"),                 // むくみ
  holdingTime: integer("holding_time"),           // 抱っこ時間(分)
  holdingUserId: text("holding_user_id"),         // 抱っこ担当
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMamaHealthSchema = createInsertSchema(mamaHealthRecords).omit({ id: true, createdAt: true });
export type MamaHealthRecord = typeof mamaHealthRecords.$inferSelect;
export type InsertMamaHealthRecord = typeof mamaHealthRecords.$inferInsert;

export const mamaMedicineRecords = pgTable("mama_medicine_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  userId: text("user_id").notNull(),
  medicineName: text("medicine_name").notNull(),
  dosage: text("dosage"),
  memo: text("memo"),
  takenAt: timestamp("taken_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMamaMedicineSchema = createInsertSchema(mamaMedicineRecords).omit({ id: true, createdAt: true });
export type MamaMedicineRecord = typeof mamaMedicineRecords.$inferSelect;

export const weBoard = pgTable("we_board", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWeBoardSchema = createInsertSchema(weBoard).omit({ id: true, createdAt: true });

export const insertSkillCompletionSchema = createInsertSchema(skillCompletions).omit({ id: true, completedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ id: true, createdAt: true });

export const insertSleepSessionSchema = createInsertSchema(sleepSessions).omit({ id: true, createdAt: true });

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertSleepChecklistSchema = createInsertSchema(sleepChecklist).omit({ id: true, createdAt: true });
export const insertSleepRoutineSchema = createInsertSchema(sleepRoutines).omit({ id: true, createdAt: true });
export const insertSleepRoutineLogSchema = createInsertSchema(sleepRoutineLogs).omit({ id: true, completedAt: true });

export type Child = typeof children.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type UserCoupon = typeof userCoupons.$inferSelect;
export type InsertUserCoupon = z.infer<typeof insertUserCouponSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type GrowthRecord = typeof growthRecords.$inferSelect;
export type InsertGrowthRecord = z.infer<typeof insertGrowthRecordSchema>;
export type SleepChecklist = typeof sleepChecklist.$inferSelect;
export type InsertSleepChecklist = z.infer<typeof insertSleepChecklistSchema>;
export type SleepRoutine = typeof sleepRoutines.$inferSelect;
export type InsertSleepRoutine = z.infer<typeof insertSleepRoutineSchema>;
export type SleepRoutineLog = typeof sleepRoutineLogs.$inferSelect;
export type InsertSleepRoutineLog = z.infer<typeof insertSleepRoutineLogSchema>;
export type SleepSession = typeof sleepSessions.$inferSelect;
export type InsertSleepSession = z.infer<typeof insertSleepSessionSchema>;
export type SkillCompletion = typeof skillCompletions.$inferSelect;
export type InsertSkillCompletion = z.infer<typeof insertSkillCompletionSchema>;
export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type WeBoard = typeof weBoard.$inferSelect;
export type InsertWeBoard = z.infer<typeof insertWeBoardSchema>;

export const healthRecords = pgTable("health_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  recordedAt: date("recorded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHealthRecordSchema = createInsertSchema(healthRecords).omit({ id: true, createdAt: true });
export type HealthRecord = typeof healthRecords.$inferSelect;
export type InsertHealthRecord = z.infer<typeof insertHealthRecordSchema>;

export const vaccinationRecords = pgTable("vaccination_records", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull().default("default"),
  childId: integer("child_id"),
  vaccineId: text("vaccine_id").notNull(),
  administeredDate: date("administered_date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVaccinationRecordSchema = createInsertSchema(vaccinationRecords).omit({ id: true, createdAt: true });
export type VaccinationRecord = typeof vaccinationRecords.$inferSelect;
export type InsertVaccinationRecord = z.infer<typeof insertVaccinationRecordSchema>;

export const customVaccines = pgTable("custom_vaccines", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  childId: integer("child_id"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomVaccineSchema = createInsertSchema(customVaccines).omit({ id: true, createdAt: true });
export type CustomVaccine = typeof customVaccines.$inferSelect;
export type InsertCustomVaccine = z.infer<typeof insertCustomVaccineSchema>;

export const foodIngredients = pgTable("food_ingredients", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  childId: integer("child_id"),
  ingredientName: text("ingredient_name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("not_tried"),
  firstTriedDate: date("first_tried_date"),
  notes: text("notes"),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFoodIngredientSchema = createInsertSchema(foodIngredients).omit({ id: true, createdAt: true, updatedAt: true });
export type FoodIngredient = typeof foodIngredients.$inferSelect;
export type InsertFoodIngredient = z.infer<typeof insertFoodIngredientSchema>;

// ── Sponsor & Promotion tables ──────────────────────────────────────────────

export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  websiteUrl: text("website_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id"),
  triggerLogType: text("trigger_log_type").notNull(),
  triggerTimeStart: integer("trigger_time_start"),
  triggerTimeEnd: integer("trigger_time_end"),
  message: text("message").notNull(),
  couponId: integer("coupon_id"),
  externalUrl: text("external_url"),
  impressionCount: integer("impression_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sponsoredCoupons = pgTable("sponsored_coupons", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id").notNull(),
  familyId: text("family_id"),
  title: text("title").notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull().default(0),
  originalValue: text("original_value"),
  imageUrl: text("image_url"),
  externalUrl: text("external_url"),
  totalStock: integer("total_stock"),
  remainingStock: integer("remaining_stock"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promotionImpressions = pgTable("promotion_impressions", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").notNull(),
  familyId: text("family_id").notNull(),
  userId: text("user_id").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const insertSponsorSchema = createInsertSchema(sponsors).omit({ id: true, createdAt: true });
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true });
export const insertSponsoredCouponSchema = createInsertSchema(sponsoredCoupons).omit({ id: true, createdAt: true });

export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = z.infer<typeof insertSponsorSchema>;
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type SponsoredCoupon = typeof sponsoredCoupons.$inferSelect;
export type InsertSponsoredCoupon = z.infer<typeof insertSponsoredCouponSchema>;
export type PromotionImpression = typeof promotionImpressions.$inferSelect;

export const customChildcareItems = pgTable("custom_childcare_items", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  itemName: text("item_name").notNull(),
  icon: text("icon").notNull().default("Star"),
  createdBy: text("created_by"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomChildcareItemSchema = createInsertSchema(customChildcareItems).omit({ id: true, createdAt: true });
export type CustomChildcareItem = typeof customChildcareItems.$inferSelect;
export type InsertCustomChildcareItem = z.infer<typeof insertCustomChildcareItemSchema>;

// ── Community tables ────────────────────────────────────────────────────────

export const communityProfiles = pgTable("community_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  nickname: text("nickname").notNull(),
  avatarIcon: text("avatar_icon").notNull().default("bear"),
  childAgeMonths: integer("child_age_months"),
  showChildAge: boolean("show_child_age").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityRooms = pgTable("community_rooms", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("challenge"),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("💬"),
  triggerLogTypes: text("trigger_log_types"),
  ageMonthsMin: integer("age_months_min"),
  ageMonthsMax: integer("age_months_max"),
  maxMembers: integer("max_members").notNull().default(150),
  currentMembers: integer("current_members").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityMemberships = pgTable("community_memberships", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  profileId: integer("profile_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  profileId: integer("profile_id").notNull(),
  body: text("body").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityReactions = pgTable("community_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  profileId: integer("profile_id").notNull(),
  type: text("type").notNull().default("wakaru"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityReports = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id"),
  reporterProfileId: integer("reporter_profile_id").notNull(),
  targetProfileId: integer("target_profile_id"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityBlocks = pgTable("community_blocks", {
  id: serial("id").primaryKey(),
  blockerProfileId: integer("blocker_profile_id").notNull(),
  blockedProfileId: integer("blocked_profile_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommunityProfileSchema = createInsertSchema(communityProfiles).omit({ id: true, createdAt: true });
export const insertCommunityRoomSchema = createInsertSchema(communityRooms).omit({ id: true, createdAt: true });
export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({ id: true, createdAt: true, isHidden: true });

export type CommunityProfile = typeof communityProfiles.$inferSelect;
export type InsertCommunityProfile = z.infer<typeof insertCommunityProfileSchema>;
export type CommunityRoom = typeof communityRooms.$inferSelect;
export type InsertCommunityRoom = z.infer<typeof insertCommunityRoomSchema>;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityReaction = typeof communityReactions.$inferSelect;
export type CommunityReport = typeof communityReports.$inferSelect;
export type CommunityBlock = typeof communityBlocks.$inferSelect;
