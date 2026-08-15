import Std.Tactic

/-!
# The green road and the Emerald Curse

Every certified spell externalizes exactly one fragment of the curse as a
road step. The road is persistent because it is a projection of the existing
certificate, not a second mutable counter owned by the host.
-/

namespace Imba

def castleDistance : Nat := 12

def firstChapterDistance : Nat := 4

theorem firstChapter_before_castle :
    firstChapterDistance <= castleDistance := by
  native_decide

def roadBricks (certificate : Nat) : Nat :=
  certificate

def curseRemaining (certificate : Nat) : Nat :=
  castleDistance - min (roadBricks certificate) castleDistance

inductive RavenForm where
  | cursedWalker
  | worldMagus
  deriving Repr, DecidableEq, BEq

def RavenForm.label : RavenForm -> String
  | .cursedWalker => "CURSED_WALKER"
  | .worldMagus => "WORLD_MAGUS"

def RavenForm.title : RavenForm -> String
  | .cursedWalker => "Ворон под заклятием"
  | .worldMagus => "Ворон — маг Мира"

def worldTruthKnown (bricks : Nat) : Bool :=
  firstChapterDistance <= bricks

def ravenForm (bricks : Nat) : RavenForm :=
  if worldTruthKnown bricks then .worldMagus else .cursedWalker

def chapterConflict (bricks : Nat) : Bool :=
  bricks == firstChapterDistance

def worldRevelation : String :=
  "Мир утверждал, что он не магия. Ворон увидел: каждый его закон сложен из магических морфизмов."

theorem road_and_curse_complete (certificate : Nat) :
    min (roadBricks certificate) castleDistance + curseRemaining certificate = castleDistance := by
  exact Nat.add_sub_of_le (Nat.min_le_right _ _)

inductive WizardTrouble where
  | falseBrick
  | emeraldFog
  | tickLeech
  | axisShift
  | mirrorDouble
  | roadDebt
  deriving Repr, DecidableEq, BEq

def WizardTrouble.label : WizardTrouble -> String
  | .falseBrick => "FALSE_STEP"
  | .emeraldFog => "EMERALD_FOG"
  | .tickLeech => "TICK_LEECH"
  | .axisShift => "AXIS_SHIFT"
  | .mirrorDouble => "MIRROR_DOUBLE"
  | .roadDebt => "ROAD_DEBT"

def WizardTrouble.title : WizardTrouble -> String
  | .falseBrick => "Ложный шаг"
  | .emeraldFog => "Изумрудный туман"
  | .tickLeech => "Пожиратель тиков"
  | .axisShift => "Сдвиг осей"
  | .mirrorDouble => "Зеркальный двойник"
  | .roadDebt => "Долг дороги"

def WizardTrouble.copy : WizardTrouble -> String
  | .falseBrick => "Замок подмешивает в путь переход без допустимого интерфейса."
  | .emeraldFog => "Волшебник скрывает часть закона, но не может изменить его после выбора."
  | .tickLeech => "Беда давит на накопленное время и требует точной связности."
  | .axisShift => "Оси Мира смещены; прежняя очевидная проекция больше не надёжна."
  | .mirrorDouble => "Замок возвращает прошлую форму игрока как чужое отражение."
  | .roadDebt => "Следующий шаг по дороге требует объявленной цены, а не бесплатного чуда."

def troubleAt (identity bricks : Nat) : Option WizardTrouble :=
  if bricks == 0 then none else some <|
    match (identity + bricks * 7) % 6 with
    | 0 => .falseBrick
    | 1 => .emeraldFog
    | 2 => .tickLeech
    | 3 => .axisShift
    | 4 => .mirrorDouble
    | _ => .roadDebt

def troublePower (identity bricks : Nat) : Nat :=
  if bricks == 0 then 0 else (identity * 11 + bricks * 5) % 5 + 1

def journeyChapter (bricks : Nat) : String :=
  if bricks == 0 then "0 / ОБУЧЕНИЕ"
  else if bricks < firstChapterDistance then "I / ДОРОГА ПРОСЫПАЕТСЯ"
  else if bricks == firstChapterDistance then "I / КОНФЛИКТ: МИР ЕСТЬ МАГИЯ"
  else "АВТОРСКИЙ РУБЕЖ / ГЛАВА I"

example : roadBricks 5 = 5 := by native_decide
example : curseRemaining 5 = 7 := by native_decide
example : roadBricks 99 = 99 := by native_decide
example : ravenForm 3 = .cursedWalker := by native_decide
example : ravenForm firstChapterDistance = .worldMagus := by native_decide
example : chapterConflict firstChapterDistance = true := by native_decide

end Imba
