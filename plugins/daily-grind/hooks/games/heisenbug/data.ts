// Heisenbug puzzles. Each snippet has exactly one wrong line; swapping in `fix` makes every clue pass.
// Authoring: write the code with the buggy line prefixed by `!`; `p()` strips it and records the index.
// A `fix` without leading whitespace inherits the buggy line's indentation.
// Clue values are formatted like the language prints them (JS: JSON-ish, Python: repr; `throws X` for errors).
// Checked by ./verify.mjs (bun hooks/games/heisenbug/verify.mjs), which runs buggy and fixed code per clue.

export type Lang = 'javascript' | 'typescript' | 'python'
export type Clue = { input: string; expected: string; actual: string }
export type Puzzle = { lang: Lang; title: string; lines: string[]; bugLine: number; clues: Clue[]; fix: string; why: string }

const p = (lang: Lang, title: string, code: string, fix: string, why: string, clues: [string, string, string][]): Puzzle => {
  const raw = code.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n')
  const bugLine = raw.findIndex(l => l.startsWith('!'))
  const lines = raw.map((l, i) => (i === bugLine ? ' ' + l.slice(1) : l))
  const indent = lines[bugLine]!.match(/^\s*/)![0]
  return {
    lang, title, lines, bugLine,
    fix: /^\s/.test(fix) ? fix : indent + fix,
    why,
    clues: clues.map(([input, expected, actual]) => ({ input, expected, actual })),
  }
}
const js = (t: string, c: string, f: string, w: string, k: [string, string, string][]) => p('javascript', t, c, f, w, k)
const ts = (t: string, c: string, f: string, w: string, k: [string, string, string][]) => p('typescript', t, c, f, w, k)
const py = (t: string, c: string, f: string, w: string, k: [string, string, string][]) => p('python', t, c, f, w, k)

export const PUZZLES: Puzzle[] = [
  js('average', String.raw`
function average(nums) {
  if (nums.length === 0) return 0
  let total = 0
! for (let i = 1; i < nums.length; i++) {
    total += nums[i]
  }
  const avg = total / nums.length
  return Math.round(avg * 100) / 100
}`, 'for (let i = 0; i < nums.length; i++) {', 'The loop starts at index 1, so the first number is never added.', [
    ['average([2, 4, 6])', '4', '3.33'],
    ['average([10])', '10', '0'],
    ['average([1, 2])', '1.5', '1'],
  ]),

  py('add_tags', String.raw`
def add_tags(new_tags, existing=[]):
    """Return existing plus new_tags, normalized and deduplicated."""
!   tags = existing
    for tag in new_tags:
        tag = tag.strip().lower()
        if tag and tag not in tags:
            tags.append(tag)
    return tags`, 'tags = list(existing)', 'tags aliases the shared default list, so every call appends to the same list.', [
    ["[add_tags(['a']), add_tags(['b'])]", "[['a'], ['b']]", "[['a', 'b'], ['a', 'b']]"],
    ["[add_tags(['x']), add_tags(['x', 'y'])]", "[['x'], ['x', 'y']]", "[['x', 'y'], ['x', 'y']]"],
    ["[add_tags([]), add_tags(['q'])]", "[[], ['q']]", "[['q'], ['q']]"],
  ]),

  js('lastN', String.raw`
function lastN(items, n) {
  if (n <= 0) return []
  const out = []
! for (let i = items.length - n; i <= items.length; i++) {
    if (i >= 0) out.push(items[i])
  }
  return out
}`, 'for (let i = items.length - n; i < items.length; i++) {', '`<=` walks one past the end and pushes undefined.', [
    ['lastN([1, 2, 3], 2)', '[2, 3]', '[2, 3, undefined]'],
    ['lastN(["a"], 1)', '["a"]', '["a", undefined]'],
    ['lastN([4, 5], 5)', '[4, 5]', '[4, 5, undefined]'],
  ]),

  py('countdown', String.raw`
def countdown(n):
    """Return [n, n-1, ..., 1, 'liftoff']."""
    if n < 0:
        raise ValueError('n must be >= 0')
    out = []
!   for i in range(n, 0, 1):
        out.append(i)
    out.append('liftoff')
    return out`, 'for i in range(n, 0, -1):', 'A positive step counting from n up to 0 produces an empty range.', [
    ['countdown(3)', "[3, 2, 1, 'liftoff']", "['liftoff']"],
    ['countdown(1)', "[1, 'liftoff']", "['liftoff']"],
    ['countdown(2)', "[2, 1, 'liftoff']", "['liftoff']"],
  ]),

  js('countExact', String.raw`
function countExact(values, target) {
  let count = 0
  for (const v of values) {
!   if (v == target) {
      count++
    }
  }
  return count
}`, 'if (v === target) {', 'Loose `==` coerces types, so "1", false and "" match too.', [
    ['countExact([1, "1", 1], 1)', '2', '3'],
    ['countExact([0, "", false], 0)', '1', '3'],
    ['countExact([null, undefined], null)', '1', '2'],
  ]),

  py('stats', String.raw`
def stats(values):
    values = [v for v in values if v is not None]
    if not values:
        return {'mean': 0.0, 'min': None, 'max': None}
    total = sum(values)
    count = len(values)
!   mean = total // count
    return {'mean': mean, 'min': min(values), 'max': max(values)}`, 'mean = total / count', '`//` is floor division and throws away the fractional part of the mean.', [
    ['stats([1, 2])', "{'mean': 1.5, 'min': 1, 'max': 2}", "{'mean': 1, 'min': 1, 'max': 2}"],
    ['stats([3, 4, None])', "{'mean': 3.5, 'min': 3, 'max': 4}", "{'mean': 3, 'min': 3, 'max': 4}"],
    ['stats([1, 1, 2])', "{'mean': 1.3333333333333333, 'min': 1, 'max': 2}", "{'mean': 1, 'min': 1, 'max': 2}"],
  ]),

  js('labels', String.raw`
function labels(users) {
  const active = users.filter(u => u.active)
  const named = active.map(u => {
    const first = u.name.split(' ')[0]
!   first.toUpperCase()
  })
  return named.join(', ')
}`, 'return first.toUpperCase()', 'A braced arrow body needs an explicit return; the map yields undefined.', [
    ['labels([{ name: "Ada L", active: true }])', '"ADA"', '""'],
    ['labels([{ name: "Ada L", active: true }, { name: "Bo K", active: true }])', '"ADA, BO"', '", "'],
    ['labels([{ name: "Cy D", active: false }, { name: "Di E", active: true }])', '"DI"', '""'],
  ]),

  py('leaderboard', String.raw`
def leaderboard(scores, limit=3):
    """scores: {name: points}. Return the top names, best first."""
    if not scores:
        return []
    names = [n for n in scores if scores[n] > 0]
!   ordered = names.sort(key=lambda n: scores[n], reverse=True)
    top = ordered[:limit]
    return [f'{i + 1}. {n}' for i, n in enumerate(top)]`, 'ordered = sorted(names, key=lambda n: scores[n], reverse=True)', 'list.sort() sorts in place and returns None.', [
    ["leaderboard({'ann': 5, 'bo': 9})", "['1. bo', '2. ann']", 'throws TypeError'],
    ["leaderboard({'cy': 1})", "['1. cy']", 'throws TypeError'],
    ["leaderboard({'a': 3, 'b': 2, 'c': 9, 'd': 1})", "['1. c', '2. a', '3. b']", 'throws TypeError'],
  ]),

  js('invoiceTotal', String.raw`
function invoiceTotal(price, qty, taxRate) {
  if (qty <= 0) return 0
  const subtotal = price * qty
  const discount = qty >= 10 ? 0.1 : 0
  const discounted = subtotal * (1 - discount)
! const total = discounted * 1 + taxRate
  return Math.round(total * 100) / 100
}`, 'const total = discounted * (1 + taxRate)', '`*` binds tighter than `+`, so the tax rate is added as a flat amount.', [
    ['invoiceTotal(10, 2, 0.5)', '30', '20.5'],
    ['invoiceTotal(5, 1, 0.2)', '6', '5.2'],
    ['invoiceTotal(10, 10, 0.1)', '99', '90.1'],
  ]),

  py('scaled', String.raw`
def scaled(values, factors):
    """Return [[v * f for v in values] for f in factors], built from functions."""
    scalers = []
    for f in factors:
!       scalers.append(lambda v: v * f)
    out = []
    for scale in scalers:
        out.append([scale(v) for v in values])
    return out`, 'scalers.append(lambda v, f=f: v * f)', 'Closures capture the variable f, not its value, so every lambda sees the last factor.', [
    ['scaled([1, 2], [2, 3])', '[[2, 4], [3, 6]]', '[[3, 6], [3, 6]]'],
    ['scaled([5], [0, 1])', '[[0], [5]]', '[[5], [5]]'],
    ['scaled([1], [1, 2, 10])', '[[1], [2], [10]]', '[[10], [10], [10]]'],
  ]),

  js('rankOf', String.raw`
function rankOf(scores, player) {
  if (player < 0 || player >= scores.length) return -1
! const sorted = scores.sort((a, b) => b - a)
  const mine = scores[player]
  const rank = sorted.indexOf(mine) + 1
  const total = scores.length
  return rank + ' of ' + total
}`, 'const sorted = [...scores].sort((a, b) => b - a)', 'Array.sort mutates in place, so scores[player] reads the reordered array.', [
    ['rankOf([10, 30, 20], 0)', '"3 of 3"', '"1 of 3"'],
    ['rankOf([5, 9], 0)', '"2 of 2"', '"1 of 2"'],
    ['rankOf([1, 2, 3], 2)', '"1 of 3"', '"3 of 3"'],
  ]),

  py('drop_empty', String.raw`
def drop_empty(record):
    """Remove keys whose value is None or '' and return how many went."""
    if not isinstance(record, dict):
        raise TypeError('record must be a dict')
    removed = 0
!   for key in record:
        if record[key] is None or record[key] == '':
            del record[key]
            removed += 1
    return removed`, 'for key in list(record):', 'Deleting from a dict while iterating it raises RuntimeError; iterate over a copy of the keys.', [
    ["drop_empty({'a': 1, 'b': None})", '1', 'throws RuntimeError'],
    ["drop_empty({'a': '', 'b': 2})", '1', 'throws RuntimeError'],
    ["drop_empty({'x': None, 'y': None})", '2', 'throws RuntimeError'],
  ]),

  js('longestWord', String.raw`
function longestWord(text) {
  let longest = ''
  for (const word of text.split(' ')) {
    if (word.length > longest.length) {
!     let longest = word
    }
  }
  return longest
}`, 'longest = word', '`let` declares a new block-scoped variable that shadows the outer one.', [
    ['longestWord("a bb ccc")', '"ccc"', '""'],
    ['longestWord("hello")', '"hello"', '""'],
    ['longestWord("hi there you")', '"there"', '""'],
  ]),

  py('oldest', String.raw`
def oldest(people):
    """people: list of 'name:age' strings. Return the oldest name."""
    best_name, best_age = None, None
    for entry in people:
        name, age = entry.split(':')
!       age = age.strip()
        if best_age is None or age > best_age:
            best_name, best_age = name, age
    return best_name`, 'age = int(age)', 'Ages stay strings, so they compare alphabetically: "9" > "10".', [
    ["oldest(['ann:9', 'bo:10'])", "'bo'", "'ann'"],
    ["oldest(['cy:100', 'di:42'])", "'cy'", "'di'"],
    ["oldest(['ed:5', 'flo:30', 'gus:7'])", "'flo'", "'gus'"],
  ]),

  js('binarySearch', String.raw`
function binarySearch(arr, target) {
  let lo = 0
  let hi = arr.length - 1
! while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (arr[mid] === target) return mid
    if (arr[mid] < target) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}`, 'while (lo <= hi) {', 'With an inclusive hi, the loop must still run when lo === hi.', [
    ['binarySearch([5], 5)', '0', '-1'],
    ['binarySearch([1, 3, 5], 5)', '2', '-1'],
    ['binarySearch([1, 3, 5, 7], 1)', '0', '-1'],
  ]),

  py('window_sums', String.raw`
def window_sums(nums, k):
    """Sums of every run of k consecutive numbers."""
    if k <= 0 or k > len(nums):
        return []
    sums = []
!   for i in range(len(nums) - k):
        sums.append(sum(nums[i:i + k]))
    return sums`, 'for i in range(len(nums) - k + 1):', 'There are len - k + 1 windows; range stops one short and drops the last.', [
    ['window_sums([1, 2, 3], 2)', '[3, 5]', '[3]'],
    ['window_sums([4, 4], 2)', '[8]', '[]'],
    ['window_sums([1, 2, 3, 4], 1)', '[1, 2, 3, 4]', '[1, 2, 3]'],
  ]),

  js('setVolume', String.raw`
function setVolume(player, level) {
  const MIN = 0
  const MAX = 100
! const clamped = Math.min(MIN, Math.max(MAX, level))
  player.volume = clamped
  player.muted = clamped === 0
  return player
}`, 'const clamped = Math.max(MIN, Math.min(MAX, level))', 'min and max are swapped, so the clamp always collapses to MIN.', [
    ['setVolume({}, 50)', '{ volume: 50, muted: false }', '{ volume: 0, muted: true }'],
    ['setVolume({}, 150)', '{ volume: 100, muted: false }', '{ volume: 0, muted: true }'],
    ['setVolume({}, 1)', '{ volume: 1, muted: false }', '{ volume: 0, muted: true }'],
  ]),

  py('contains', String.raw`
def contains(tree, target):
    """tree is None or (value, left, right), a binary search tree."""
    if tree is None:
        return False
    value, left, right = tree
    if target == value:
        return True
    if target < value:
!       contains(left, target)
    return contains(right, target)`, 'return contains(left, target)', 'The left result is discarded, so the search falls through to the right subtree.', [
    ['contains((5, (2, None, None), None), 2)', 'True', 'False'],
    ['contains((8, (3, (1, None, None), None), None), 1)', 'True', 'False'],
    ['contains((4, (2, None, (3, None, None)), (6, None, None)), 3)', 'True', 'False'],
  ]),

  js('isPalindrome', String.raw`
function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '')
  let i = 0
! let j = clean.length
  while (i < j) {
    if (clean[i] !== clean[j]) return false
    i++
    j--
  }
  return true
}`, 'let j = clean.length - 1', 'clean[clean.length] is undefined; the last character is at length - 1.', [
    ['isPalindrome("racecar")', 'true', 'false'],
    ['isPalindrome("A man, a plan, a canal: Panama")', 'true', 'false'],
    ['isPalindrome("aa")', 'true', 'false'],
  ]),

  py('can_edit', String.raw`
def can_edit(user, doc):
    """Admins and owners may edit, but never a locked doc."""
    if user is None:
        return False
    is_admin = user.get('admin', False)
    is_owner = user.get('id') == doc.get('owner')
    locked = doc.get('locked', False)
!   return is_admin or is_owner and not locked`, 'return (is_admin or is_owner) and not locked', '`and` binds tighter than `or`, so admins bypass the lock.', [
    ["can_edit({'admin': True}, {'locked': True})", 'False', 'True'],
    ["can_edit({'admin': True, 'id': 1}, {'owner': 1, 'locked': True})", 'False', 'True'],
    ["can_edit({'admin': True, 'id': 7}, {'owner': 2, 'locked': True})", 'False', 'True'],
  ]),

  js('chunk', String.raw`
function chunk(arr, size) {
  if (size < 1) throw new Error('size must be >= 1')
  const out = []
! for (let i = 0; i < arr.length; i += size - 1) {
    out.push(arr.slice(i, i + size))
  }
  return out
}`, 'for (let i = 0; i < arr.length; i += size) {', 'Stepping by size - 1 makes chunks overlap by one element.', [
    ['chunk([1, 2, 3, 4], 2)', '[[1, 2], [3, 4]]', '[[1, 2], [2, 3], [3, 4], [4]]'],
    ['chunk([1, 2, 3], 3)', '[[1, 2, 3]]', '[[1, 2, 3], [3]]'],
    ['chunk(["a", "b", "c", "d", "e"], 3)', '[["a", "b", "c"], ["d", "e"]]', '[["a", "b", "c"], ["c", "d", "e"], ["e"]]'],
  ]),

  py('days_in_month', String.raw`
def days_in_month(year, month):
    if not 1 <= month <= 12:
        raise ValueError('month must be 1-12')
    if month == 2:
        leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
        return 29 if leap else 28
!   if month in (4, 6, 9, 10):
        return 30
    return 31`, 'if month in (4, 6, 9, 11):', 'October has 31 days; it is November that has 30.', [
    ['days_in_month(2026, 10)', '31', '30'],
    ['days_in_month(2026, 11)', '30', '31'],
    ['days_in_month(2025, 11)', '30', '31'],
  ]),

  js('charCounts', String.raw`
function charCounts(word) {
  const counts = {}
  for (const ch of word) {
    if (ch === ' ') continue
!   counts[ch] = counts[ch] + 1
  }
  return counts
}`, 'counts[ch] = (counts[ch] || 0) + 1', 'The first lookup is undefined, and undefined + 1 is NaN.', [
    ['charCounts("aab")', '{ a: 2, b: 1 }', '{ a: NaN, b: NaN }'],
    ['charCounts("hi")', '{ h: 1, i: 1 }', '{ h: NaN, i: NaN }'],
    ['charCounts("o o")', '{ o: 2 }', '{ o: NaN }'],
  ]),

  py('leap_years', String.raw`
def leap_years(start, end):
    """All Gregorian leap years from start to end inclusive."""
    if start > end:
        start, end = end, start
    found = []
    for year in range(start, end + 1):
!       if year % 4 == 0 and year % 100 != 0 and year % 400 == 0:
            found.append(year)
    return found`, 'if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):', 'No year is both not divisible by 100 and divisible by 400; the century rule needs `or`.', [
    ['leap_years(2023, 2025)', '[2024]', '[]'],
    ['leap_years(1999, 2001)', '[2000]', '[]'],
    ['leap_years(1896, 1904)', '[1896, 1904]', '[]'],
  ]),

  js('formatPrice', String.raw`
function formatPrice(item) {
  const currency = item.currency || 'USD'
! if (!item.price) {
    return 'Price unavailable'
  }
  const amount = item.price.toFixed(2)
  return currency + ' ' + amount
}`, 'if (item.price == null) {', 'A price of 0 is falsy, so free items look like missing prices.', [
    ['formatPrice({ price: 0 })', '"USD 0.00"', '"Price unavailable"'],
    ['formatPrice({ price: 0, currency: "EUR" })', '"EUR 0.00"', '"Price unavailable"'],
    ['formatPrice({ price: -0, currency: "GBP" })', '"GBP 0.00"', '"Price unavailable"'],
  ]),

  py('numbered', String.raw`
def numbered(items, start=1):
    """Format items as a numbered list, starting at start."""
    lines = []
!   for i, item in enumerate(items):
        label = str(item).strip()
        if label:
            lines.append(f'{i}. {label}')
    return lines`, 'for i, item in enumerate(items, start):', 'enumerate counts from 0 unless given a start, and start is never passed.', [
    ["numbered(['a', 'b'])", "['1. a', '2. b']", "['0. a', '1. b']"],
    ["numbered(['x'], 5)", "['5. x']", "['0. x']"],
    ["numbered(['one'], 10)", "['10. one']", "['0. one']"],
  ]),

  js('parseIds', String.raw`
function parseIds(csv) {
  if (!csv) return []
  return csv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
!   .map(parseInt)
}`, '.map(s => parseInt(s, 10))', 'map passes the index as parseInt\'s radix argument.', [
    ['parseIds("1,2,3")', '[1, 2, 3]', '[1, NaN, NaN]'],
    ['parseIds("10, 10, 10")', '[10, 10, 10]', '[10, NaN, 2]'],
    ['parseIds("7,8")', '[7, 8]', '[7, NaN]'],
  ]),

  py('domain_of', String.raw`
def domain_of(email):
    """Return the domain of an address, or None if there is no '@'."""
    email = email.strip().lower()
    at = email.rfind('@')
!   if not at:
        return None
    host = email[at + 1:]
    return host or None`, 'if at == -1:', 'rfind returns -1 (truthy) when missing and 0 (falsy) for a leading @.', [
    ["domain_of('nobody')", 'None', "'nobody'"],
    ["domain_of('@x.com')", "'x.com'", 'None'],
    ["domain_of('Plain.Text')", 'None', "'plain.text'"],
  ]),

  js('topScores', String.raw`
function topScores(scores, n) {
  const valid = scores.filter(s => Number.isFinite(s))
  const unique = [...new Set(valid)]
! unique.sort()
  unique.reverse()
  const top = unique.slice(0, n)
  return top
}`, 'unique.sort((a, b) => a - b)', 'The default sort compares numbers as strings, so 10 sorts before 9.', [
    ['topScores([9, 10, 2], 2)', '[10, 9]', '[9, 2]'],
    ['topScores([100, 25, 3], 1)', '[100]', '[3]'],
    ['topScores([5, 40, 300], 3)', '[300, 40, 5]', '[5, 40, 300]'],
  ]),

  py('mark_diagonal', String.raw`
def mark_diagonal(n):
    """n x n grid of 0s with 1s on the main diagonal."""
    if n <= 0:
        return []
!   grid = [[0] * n] * n
    for i in range(n):
        grid[i][i] = 1
    return grid`, 'grid = [[0] * n for _ in range(n)]', 'Multiplying the outer list repeats one row object n times.', [
    ['mark_diagonal(2)', '[[1, 0], [0, 1]]', '[[1, 1], [1, 1]]'],
    ['mark_diagonal(3)', '[[1, 0, 0], [0, 1, 0], [0, 0, 1]]', '[[1, 1, 1], [1, 1, 1], [1, 1, 1]]'],
    ['mark_diagonal(4)', '[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]', '[[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]'],
  ]),

  js('makeCounters', String.raw`
function makeCounters(n) {
  if (n <= 0) return []
  const counters = []
! for (var i = 0; i < n; i++) {
    counters.push(() => i)
  }
  return counters.map(f => f())
}`, 'for (let i = 0; i < n; i++) {', '`var` shares one i across iterations; every closure sees its final value.', [
    ['makeCounters(3)', '[0, 1, 2]', '[3, 3, 3]'],
    ['makeCounters(1)', '[0]', '[1]'],
    ['makeCounters(2)', '[0, 1]', '[2, 2]'],
  ]),

  py('roles_for', String.raw`
def roles_for(users, names):
    """users maps name -> role. Unknown names get 'guest'."""
    result = []
    for name in names:
        name = name.lower()
!       if name in users.values():
            result.append(users[name])
        else:
            result.append('guest')
    return result`, 'if name in users:', 'Membership is checked against the roles instead of the names.', [
    ["roles_for({'ann': 'admin'}, ['Ann'])", "['admin']", "['guest']"],
    ["roles_for({'bo': 'dev', 'cy': 'ops'}, ['cy', 'zed'])", "['ops', 'guest']", "['guest', 'guest']"],
    ["roles_for({'admin': 'root'}, ['admin'])", "['root']", "['guest']"],
  ]),

  js('fizzBuzz', String.raw`
function fizzBuzz(n) {
  const out = []
  for (let i = 1; i <= n; i++) {
!   if (i % 3 === 0 || i % 5 === 0) out.push('FizzBuzz')
    else if (i % 3 === 0) out.push('Fizz')
    else if (i % 5 === 0) out.push('Buzz')
    else out.push(String(i))
  }
  return out
}`, "if (i % 3 === 0 && i % 5 === 0) out.push('FizzBuzz')", 'FizzBuzz needs both divisors; `||` catches every multiple of 3 or 5 first.', [
    ['fizzBuzz(3)', '["1", "2", "Fizz"]', '["1", "2", "FizzBuzz"]'],
    ['fizzBuzz(5)', '["1", "2", "Fizz", "4", "Buzz"]', '["1", "2", "FizzBuzz", "4", "FizzBuzz"]'],
    ['fizzBuzz(6)', '["1", "2", "Fizz", "4", "Buzz", "Fizz"]', '["1", "2", "FizzBuzz", "4", "FizzBuzz", "FizzBuzz"]'],
  ]),

  py('normalize_phone', String.raw`
def normalize_phone(raw):
    """Ten-digit US number from messy input, or None."""
    digits = raw.strip()
    for ch in ' -().':
!       digits.replace(ch, '')
    if digits.startswith('+1'):
        digits = digits[2:]
    return digits if len(digits) == 10 else None`, "digits = digits.replace(ch, '')", 'Strings are immutable; replace returns a new string that is thrown away.', [
    ["normalize_phone('555-123-4567')", "'5551234567'", 'None'],
    ["normalize_phone('(555) 123 4567')", "'5551234567'", 'None'],
    ["normalize_phone('+1 555.123.4567')", "'5551234567'", 'None'],
  ]),

  js('uniqueTags', String.raw`
function uniqueTags(posts) {
  const seen = []
  for (const post of posts) {
    for (const tag of post.tags) {
!     if (seen.indexOf(tag) > 0) continue
      seen.push(tag)
    }
  }
  return seen
}`, 'if (seen.indexOf(tag) >= 0) continue', 'indexOf returns 0 for the first element, which `> 0` treats as not found.', [
    ['uniqueTags([{ tags: ["js", "js"] }])', '["js"]', '["js", "js"]'],
    ['uniqueTags([{ tags: ["a", "b"] }, { tags: ["b", "a"] }])', '["a", "b"]', '["a", "b", "a"]'],
    ['uniqueTags([{ tags: ["x"] }, { tags: ["x", "y"] }])', '["x", "y"]', '["x", "x", "y"]'],
  ]),

  py('roster', String.raw`
def roster(teams):
    """teams: {team: [names]}. Return everyone's name, A to Z."""
    everyone = []
    for team, names in teams.items():
        if not names:
            continue
!       everyone.append(names)
    everyone.sort()
    return everyone`, 'everyone.extend(names)', 'append adds each list as a single nested item; extend adds its elements.', [
    ["roster({'a': ['zoe', 'al']})", "['al', 'zoe']", "[['zoe', 'al']]"],
    ["roster({'x': ['b'], 'y': ['a']})", "['a', 'b']", "[['a'], ['b']]"],
    ["roster({'q': ['m', 'n'], 'r': []})", "['m', 'n']", "[['m', 'n']]"],
  ]),

  js('slugify', String.raw`
function slugify(title) {
  if (!title) return ''
  const lower = title.trim().toLowerCase()
! const dashed = lower.replace(' ', '-')
  const clean = dashed.replace(/[^a-z0-9-]/g, '')
  const single = clean.replace(/-+/g, '-')
  return single
}`, "const dashed = lower.replaceAll(' ', '-')", 'replace with a string pattern only swaps the first match.', [
    ['slugify("Hello Big World")', '"hello-big-world"', '"hello-bigworld"'],
    ['slugify("a b c")', '"a-b-c"', '"a-bc"'],
    ['slugify("  Why Not Now ")', '"why-not-now"', '"why-notnow"'],
  ]),

  py('report', String.raw`
def report(scores):
    """90+ is A, 80+ is B, 70+ is C, otherwise F."""
    letters = []
    for s in scores:
        if s >= 90:
            letters.append('A')
!       elif s > 80:
            letters.append('B')
        elif s >= 70:
            letters.append('C')
        else:
            letters.append('F')
    return ''.join(letters)`, 'elif s >= 80:', 'An exact 80 should be a B, but `> 80` drops it to C.', [
    ['report([80])', "'B'", "'C'"],
    ['report([90, 80, 70])', "'ABC'", "'ACC'"],
    ['report([80, 80])', "'BB'", "'CC'"],
  ]),

  js('weekdayName', String.raw`
function weekdayName(year, month, day) {
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
! const date = new Date(Date.UTC(year, month, day))
  const idx = date.getUTCDay()
  return names[idx]
}`, 'const date = new Date(Date.UTC(year, month - 1, day))', 'JavaScript months are 0-based; month 1 is February.', [
    ['weekdayName(2026, 1, 1)', '"Thu"', '"Sun"'],
    ['weekdayName(2000, 1, 1)', '"Sat"', '"Tue"'],
    ['weekdayName(2026, 12, 25)', '"Fri"', '"Mon"'],
  ]),

  py('merge_counts', String.raw`
def merge_counts(*dicts):
    """Add any number of {word: count} dicts together."""
    if not dicts:
        return {}
    merged = {}
    for d in dicts:
        for word, count in d.items():
!           merged[word] = merged.get(word, 0) + 1
    return merged`, 'merged[word] = merged.get(word, 0) + count', 'Each entry adds 1 instead of its count.', [
    ["merge_counts({'a': 2}, {'a': 3})", "{'a': 5}", "{'a': 2}"],
    ["merge_counts({'x': 1, 'y': 4})", "{'x': 1, 'y': 4}", "{'x': 1, 'y': 1}"],
    ["merge_counts({'k': 10}, {'j': 2})", "{'k': 10, 'j': 2}", "{'k': 1, 'j': 1}"],
  ]),

  js('wordStats', String.raw`
function wordStats(words) {
  if (!Array.isArray(words)) return null
  const filtered = words.filter(w => w.length > 0)
! const total = filtered.reduce((sum, w) => sum + w.length)
  const longest = Math.max(0, ...filtered.map(w => w.length))
  const average = filtered.length ? total / filtered.length : 0
  return { count: filtered.length, total, longest, average }
}`, 'const total = filtered.reduce((sum, w) => sum + w.length, 0)', 'Without an initial value, reduce starts from the first word itself (and throws on []).', [
    ['wordStats(["ab", "cde"])', '{ count: 2, total: 5, longest: 3, average: 2.5 }', '{ count: 2, total: "ab3", longest: 3, average: NaN }'],
    ['wordStats(["hello"])', '{ count: 1, total: 5, longest: 5, average: 5 }', '{ count: 1, total: "hello", longest: 5, average: NaN }'],
    ['wordStats([])', '{ count: 0, total: 0, longest: 0, average: 0 }', 'throws TypeError'],
  ]),

  py('text_files', String.raw`
def text_files(paths):
    """Names of the .txt files, without the extension."""
    names = []
    for path in paths:
        file = path.split('/')[-1]
        if file.endswith('.txt'):
!           names.append(file.rstrip('.txt'))
    return names`, "names.append(file.removesuffix('.txt'))", 'rstrip strips any trailing run of the characters ".", "t", "x", not the suffix.', [
    ["text_files(['a/test.txt'])", "['test']", "['tes']"],
    ["text_files(['report.txt', 'notes.md'])", "['report']", "['repor']"],
    ["text_files(['docs/xtx.txt'])", "['xtx']", "['']"],
  ]),

  js('truncate', String.raw`
function truncate(text, max) {
  if (typeof text !== 'string') return ''
  if (text.length <= max) return text
  if (max <= 3) return '.'.repeat(max)
  const ellipsis = '...'
! const kept = text.slice(0, max)
  return kept + ellipsis
}`, 'const kept = text.slice(0, max - ellipsis.length)', 'The ellipsis must fit inside max, so keep max - 3 characters.', [
    ['truncate("abcdefgh", 6)', '"abc..."', '"abcdef..."'],
    ['truncate("hello world", 8)', '"hello..."', '"hello wo..."'],
    ['truncate("12345", 4)', '"1..."', '"1234..."'],
  ]),

  py('split_even_odd', String.raw`
def split_even_odd(nums):
    """Return (evens, odds), each in their original order."""
    evens, odds = [], []
    for n in nums:
!       if n % 2 == 1:
            evens.append(n)
        else:
            odds.append(n)
    return evens, odds`, 'if n % 2 == 0:', 'n % 2 == 1 is the test for odd, so the buckets are swapped.', [
    ['split_even_odd([1, 2])', '([2], [1])', '([1], [2])'],
    ['split_even_odd([4, 6, 7])', '([4, 6], [7])', '([7], [4, 6])'],
    ['split_even_odd([0, -3])', '([0], [-3])', '([-3], [0])'],
  ]),

  js('withDefaults', String.raw`
function withDefaults(options) {
  const defaults = { retries: 3, timeout: 1000, verbose: false }
  if (!options) return { ...defaults }
! const merged = { ...options, ...defaults }
  if (merged.retries < 0) merged.retries = 0
  merged.timeout = Math.min(merged.timeout, 60000)
  return merged
}`, 'const merged = { ...defaults, ...options }', 'Later spreads win; defaults overwrite every option the caller passed.', [
    ['withDefaults({ retries: 5 })', '{ retries: 5, timeout: 1000, verbose: false }', '{ retries: 3, timeout: 1000, verbose: false }'],
    ['withDefaults({ verbose: true })', '{ retries: 3, timeout: 1000, verbose: true }', '{ verbose: false, retries: 3, timeout: 1000 }'],
    ['withDefaults({ timeout: 50 })', '{ retries: 3, timeout: 50, verbose: false }', '{ timeout: 1000, retries: 3, verbose: false }'],
  ]),

  py('keywords', String.raw`
def keywords(text):
    """Lowercased words from text, minus stop words, in order."""
!   stop = ('the')
    out = []
    for word in text.lower().split():
        word = word.strip('.,!?')
        if word and word not in stop:
            out.append(word)
    return out`, "stop = ('the',)", "Without a trailing comma ('the') is a string, so `in` does substring checks.", [
    ["keywords('He ate the pie')", "['he', 'ate', 'pie']", "['ate', 'pie']"],
    ["keywords('e is for elephant')", "['e', 'is', 'for', 'elephant']", "['is', 'for', 'elephant']"],
    ["keywords('T minus ten')", "['t', 'minus', 'ten']", "['minus', 'ten']"],
  ]),

  js('totalPoints', String.raw`
function totalPoints(rounds) {
  let total = 0
! for (const points in rounds) {
    if (points < 0) continue
    total += points
  }
  return total
}`, 'for (const points of rounds) {', '`for...in` iterates the array\'s keys as strings, not its values.', [
    ['totalPoints([5, 10])', '15', '"001"'],
    ['totalPoints([7])', '7', '"00"'],
    ['totalPoints([3, -1, 4])', '7', '"0012"'],
  ]),

  py('answer_to_bool', String.raw`
def answer_to_bool(text):
    """Parse yes/no answers; anything else is None."""
    t = text.strip().lower()
!   if t == 'y' or 'yes':
        return True
    if t in ('n', 'no'):
        return False
    return None`, "if t in ('y', 'yes'):", "`or 'yes'` is a non-empty string, which is always truthy.", [
    ["answer_to_bool('no')", 'False', 'True'],
    ["answer_to_bool('maybe')", 'None', 'True'],
    ["answer_to_bool(' N ')", 'False', 'True'],
  ]),

  js('retryDelay', String.raw`
function retryDelay(attempt, opts) {
  // opts: { baseMs?, factor?, maxMs? }; 0 is a valid value for each
  if (attempt < 0) throw new RangeError('attempt must be >= 0')
! const base = opts.baseMs || 100
  const factor = opts.factor ?? 2
  const delay = base * factor ** attempt
  return Math.min(delay, opts.maxMs ?? 10000)
}`, 'const base = opts.baseMs ?? 100', '`||` replaces a deliberate 0 with the default; `??` only replaces null/undefined.', [
    ['retryDelay(3, { baseMs: 0 })', '0', '800'],
    ['retryDelay(1, { baseMs: 0, factor: 3 })', '0', '300'],
    ['retryDelay(0, { baseMs: 0 })', '0', '100'],
  ]),

  py('first_missing', String.raw`
def first_missing(required, provided):
    """Return the required keys that are missing from provided, in order."""
    if not required:
        return []
    missing = []
    for key in required:
        if key not in provided:
            missing.append(key)
!       return missing`, '    return missing', 'The return is indented into the loop, so only the first key is checked.', [
    ["first_missing(['a', 'b'], {'a': 1})", "['b']", '[]'],
    ["first_missing(['x', 'y'], {})", "['x', 'y']", "['x']"],
    ["first_missing(['p', 'q', 'r'], {'p': 0, 'q': 0})", "['r']", '[]'],
  ]),

  js('makeGrid', String.raw`
function makeGrid(rows, cols) {
! const grid = new Array(rows).fill([])
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r].push(r * cols + c)
    }
  }
  return grid
}`, 'const grid = Array.from({ length: rows }, () => [])', 'fill puts the same array object in every row.', [
    ['makeGrid(2, 2)', '[[0, 1], [2, 3]]', '[[0, 1, 2, 3], [0, 1, 2, 3]]'],
    ['makeGrid(3, 1)', '[[0], [1], [2]]', '[[0, 1, 2], [0, 1, 2], [0, 1, 2]]'],
    ['makeGrid(2, 1)', '[[0], [1]]', '[[0, 1], [0, 1]]'],
  ]),

  js('pairsSummingTo', String.raw`
function pairsSummingTo(nums, target) {
  const pairs = []
  for (let i = 0; i < nums.length; i++) {
!   for (let j = i; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) pairs.push([nums[i], nums[j]])
    }
  }
  return pairs
}`, 'for (let j = i + 1; j < nums.length; j++) {', 'Starting j at i pairs each number with itself.', [
    ['pairsSummingTo([1, 2, 3], 4)', '[[1, 3]]', '[[1, 3], [2, 2]]'],
    ['pairsSummingTo([5, 5], 10)', '[[5, 5]]', '[[5, 5], [5, 5], [5, 5]]'],
    ['pairsSummingTo([2, 4], 4)', '[]', '[[2, 2]]'],
  ]),

  js('addAll', String.raw`
function addAll(inputs) {
  let total = 0
  for (const raw of inputs) {
    const n = raw.trim()
    if (n === '') continue
!   total += n
  }
  return total
}`, 'total += Number(n)', 'Adding a string to a number concatenates instead of summing.', [
    ['addAll(["1", "2"])', '3', '"012"'],
    ['addAll([" 5 "])', '5', '"05"'],
    ['addAll(["10", "", "20"])', '30', '"01020"'],
  ]),

  js('badge', String.raw`
function badge(user) {
  if (!user) return ''
  const name = user.nickname || user.name
  const unread = user.unread || 0
! const title = 'Hi ' + user.admin ? 'admin ' + name : name
  const suffix = unread > 0 ? ' (' + unread + ')' : ''
  return title + suffix
}`, "const title = 'Hi ' + (user.admin ? 'admin ' + name : name)", '`+` binds tighter than `?:`, so the always-truthy "Hi ..." string is the condition.', [
    ['badge({ name: "Ada" })', '"Hi Ada"', '"admin Ada"'],
    ['badge({ name: "Bo", admin: true, unread: 2 })', '"Hi admin Bo (2)"', '"admin Bo (2)"'],
    ['badge({ name: "Cy", nickname: "C" })', '"Hi C"', '"admin C"'],
  ]),

  js('paginate', String.raw`
function paginate(items, pageNum, perPage) {
  if (pageNum < 1 || perPage < 1) return null
  const start = (pageNum - 1) * perPage
! const rows = items.splice(start, perPage)
  const total = items.length
  const pages = Math.ceil(total / perPage)
  return { rows, total, pages }
}`, 'const rows = items.slice(start, start + perPage)', 'splice removes the rows from the caller\'s array, shrinking the total.', [
    ['paginate([1, 2, 3, 4, 5], 1, 2)', '{ rows: [1, 2], total: 5, pages: 3 }', '{ rows: [1, 2], total: 3, pages: 2 }'],
    ['paginate(["a", "b"], 1, 1)', '{ rows: ["a"], total: 2, pages: 2 }', '{ rows: ["a"], total: 1, pages: 1 }'],
    ['paginate([1, 2, 3], 2, 2)', '{ rows: [3], total: 3, pages: 2 }', '{ rows: [3], total: 2, pages: 1 }'],
  ]),

  ts('groupBy', String.raw`
function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
!   groups[k] = [item]
  }
  return groups
}`, 'groups[k] = [...(groups[k] ?? []), item]', 'Each item replaces its group instead of joining it.', [
    ['groupBy(["apple", "avocado", "banana"], s => s[0])', '{ a: ["apple", "avocado"], b: ["banana"] }', '{ a: ["avocado"], b: ["banana"] }'],
    ['groupBy([1, 2, 3, 4], n => n % 2 ? "odd" : "even")', '{ odd: [1, 3], even: [2, 4] }', '{ odd: [3], even: [4] }'],
    ['groupBy(["x", "x"], s => s)', '{ x: ["x", "x"] }', '{ x: ["x"] }'],
  ]),

  ts('pageCount', String.raw`
interface PageInfo { total: number; perPage: number }

function pageCount({ total, perPage }: PageInfo): { pages: number; last: number } {
  if (perPage <= 0) throw new RangeError('perPage must be positive')
  if (total <= 0) return { pages: 1, last: 0 }
! const pages = Math.round(total / perPage)
  const last = total - (pages - 1) * perPage
  return { pages, last }
}`, 'const pages = Math.ceil(total / perPage)', 'A partial last page still needs a page; round drops it when the remainder is small.', [
    ['pageCount({ total: 11, perPage: 10 })', '{ pages: 2, last: 1 }', '{ pages: 1, last: 11 }'],
    ['pageCount({ total: 21, perPage: 5 })', '{ pages: 5, last: 1 }', '{ pages: 4, last: 6 }'],
    ['pageCount({ total: 7, perPage: 3 })', '{ pages: 3, last: 1 }', '{ pages: 2, last: 4 }'],
  ]),

  ts('initials', String.raw`
function initials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(p => p.length > 0)
  if (parts.length === 0) return ''
  const first = parts[0][0]
  if (parts.length === 1) return first.toUpperCase()
! const last = parts[1][0]
  return (first + last).toUpperCase()
}`, 'const last = parts[parts.length - 1][0]', 'parts[1] is the second name, not the last one.', [
    ['initials("Ada King Lovelace")', '"AL"', '"AK"'],
    ['initials("mary ann evans")', '"ME"', '"MA"'],
    ['initials("j r r tolkien")', '"JT"', '"JR"'],
  ]),

  ts('wordFreq', String.raw`
function wordFreq(text: string): Record<string, number> {
  const freq = new Map<string, number>()
  for (const raw of text.split(' ')) {
    const word = raw.toLowerCase()
    if (!word) continue
!   freq.set(word, freq.get(word) ?? 0 + 1)
  }
  return Object.fromEntries(freq)
}`, 'freq.set(word, (freq.get(word) ?? 0) + 1)', '`+` binds tighter than `??`, so an existing count is stored back unchanged.', [
    ['wordFreq("a a b")', '{ a: 2, b: 1 }', '{ a: 1, b: 1 }'],
    ['wordFreq("The the THE")', '{ the: 3 }', '{ the: 1 }'],
    ['wordFreq("x y x y x")', '{ x: 3, y: 2 }', '{ x: 1, y: 1 }'],
  ]),

  ts('clickAll', String.raw`
class Counter {
  count = 0
  increment(): number {
    this.count++
    return this.count
  }
}

function clickAll(counter: Counter, clicks: number): number {
! const handler = counter.increment
  for (let i = 0; i < clicks; i++) handler()
  return counter.count
}`, 'const handler = () => counter.increment()', 'A detached method loses `this`, so this.count throws.', [
    ['clickAll(new Counter(), 3)', '3', 'throws TypeError'],
    ['clickAll(new Counter(), 1)', '1', 'throws TypeError'],
    ['clickAll(new Counter(), 5)', '5', 'throws TypeError'],
  ]),

  ts('countOn', String.raw`
function countOn(dates: Date[], day: Date): number {
  let n = 0
  for (const d of dates) {
    const sameDay =
      d.getUTCFullYear() === day.getUTCFullYear() &&
      d.getUTCMonth() === day.getUTCMonth() &&
!     d.getUTCDay() === day.getUTCDay()
    if (sameDay) n++
  }
  return n
}`, 'd.getUTCDate() === day.getUTCDate()', 'getUTCDay is the weekday (0-6); the day of the month is getUTCDate.', [
    ['countOn([new Date("2026-03-02"), new Date("2026-03-09")], new Date("2026-03-02"))', '1', '2'],
    ['countOn([new Date("2026-01-05")], new Date("2026-01-12"))', '0', '1'],
    ['countOn([new Date("2026-07-01"), new Date("2026-07-08"), new Date("2026-07-15")], new Date("2026-07-15"))', '1', '3'],
  ]),

  ts('formatTime', String.raw`
function formatTime(totalSeconds: number): string {
  if (totalSeconds < 0) return '-' + formatTime(-totalSeconds)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
! const s = totalSeconds % 3600
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s)
}`, 'const s = totalSeconds % 60', 'Seconds are the remainder after whole minutes, so mod 60, not 3600.', [
    ['formatTime(75)', '"1:15"', '"1:75"'],
    ['formatTime(3661)', '"1:01:01"', '"1:01:61"'],
    ['formatTime(125)', '"2:05"', '"2:125"'],
  ]),

  ts('cartTotal', String.raw`
type Cart = { items: { price: number; qty: number }[]; coupon?: number }

function cartTotal(cart: Cart): number {
  let total = 0
  for (const item of cart.items) {
!   total = item.price * item.qty
  }
  const discount = cart.coupon ?? 0
  return Math.max(0, total - discount)
}`, 'total += item.price * item.qty', '`=` overwrites the running total, so only the last item counts.', [
    ['cartTotal({ items: [{ price: 2, qty: 3 }, { price: 5, qty: 1 }] })', '11', '5'],
    ['cartTotal({ items: [{ price: 10, qty: 1 }, { price: 1, qty: 1 }], coupon: 2 })', '9', '0'],
    ['cartTotal({ items: [{ price: 4, qty: 2 }, { price: 3, qty: 3 }] })', '17', '9'],
  ]),
]
