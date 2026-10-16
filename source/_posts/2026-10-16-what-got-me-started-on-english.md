---
title: "What Got Me Started on English: VSCode"
date: 2026-10-16 20:00:00
categories:
  - 踩坑记录
tags:
  - Python
  - 英语
  - VSCode
---

I learned Python this week. At first, I just watched the videos on Bilibili, but I didn't write much Python code, because I have been learning the basics of C.

<!-- more -->

At the beginning, it really was easy. But I felt slow, and although I already knew the basics of C, I got anxious when I watched the `if` statement. It was not about how hard it was. The reason was that I was so impatient that I couldn't focus. After that, I calmed myself down, and I began to write my first Python code.

This week I started with `if` statements and `match`, because I learned the basics of Python during the summer holidays. At that time, I just copied the code from DeepSeek, and I didn't even understand what the code meant. But now I understand what I copied, and I wrote the password check again. The triangle check came from Heima's course on Bilibili.

```python
right_account = "leiyan"
right_passward = 123456

passward = int(input("Enter your password: "))
account = input("Enter your account: ")

if passward == right_passward and account == right_account:
    print("Login successful")
elif passward == right_passward and account != right_account:
    print("Login failed, account is incorrect")
elif passward != right_passward and account == right_account:
    print("Login failed, password is incorrect")
else:
    print("Login failed, both account and password are incorrect")
```

I wrote this code in English, but I didn't find a mistake: `passward`. The code still coulde run, because I spelled it wrong in the same way everwhrere. The computer didn't care. I found it this week, when I read the code again.

Then the `match` part. This is the code:

```python
day = input("day(1-7):")

match day:
    case "1":
        print("Monday")
    case 2:
        print("Tuesday")
    case 3:
        print("Wednesday")
    case 4:
        print("Thursday")
    case 5:
        print("Friday")
    case 6 | 7:
        print("Weekend")
    case _:
        print("Invalid input")
```

When I typed 2, the program printed "Invalid input". At that time, I didn't understand why. I thought the code must use double quotation marks after `case`, or the bracket after `day`, so I tried many times. But at last, I found the problem was that I didn't use `int()`. I copied this code from Heima course, but I was negligent. `case "1"` and `case 2` are not the same type. Only `1` can work.

My first loop was a `while` loop:

```python
i = 0

while i < 10:
    print("the life is breif,but i don't use the python.")
    i += 1
else:
    print("end of the loop")
```

Then I wrote a `for` loop:

```python
total = 0

for i in range(1, 101):
    if i % 2==1:
        total += i
print(f"odd total: {total}")
```

Then I tried two `for` loops. I wanted to print a rectangle of stars:

```python
length = int(input("enter your length of the side of a quadrangle:"))

width = int(input ("enter your width of the side of a quadrangle:"))

for j in range(width):
     for i in range (length):
         print ("*",end=" ")
     print()
```

Here I made a mistake. I wrote the two `for` loops in the wrong order, so the stars on the screen were wrong.

The last one was the multiplication table:

```python
for i in range(1, 10):
    for j in range(1, i + 1):
        print(f"{j} * {i} = {i * j}",end = "\t")
    print()
```

This one confused me for a long time. At first I wrote `range(1, i)`. The last column was missing. I changed it to `range(1, i + 1)`. Then it was right. But I did not know why. Later, I knew: `range()` does not include the last number, so `range(1, i)` stops at `i - 1`.

At first, I didn't want to learn English at all. But VSCode always guessed what I was going to type, and that was amazing. It made me want to learn English, so it became my first English teacher.

Last but not least, please don't copy the code when you don't understand its meaning.

This week I was confused many times. But now, I want to meet more new bugs. Every time I fix one, I'm a little better than yesterday. That's all. Stay optimistic, stay curious, and keep going. Thank you for reading.

Bye.

The code from this post: [download `first-try.py.txt`](/code/first-try.py.txt)
