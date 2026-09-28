---
title: 我的第一个 Python 脚本：简易密码规则检查器
date: 2026-09-15 21:30:00
categories:
  - 踩坑记录
tags:
  - Python
---

这是我写的第一个 Python 脚本 —— 一个按长度、数字和字母做简单判断的小工具。它不是可靠的密码安全评估器，但里面的 bug 让我到现在还记得。

<!-- more -->

## 为什么要写这个

学 Python 的第一周，看完了基础语法（变量、循环、条件判断），但总觉得没真的会。

我的判断标准是：**能不能写一个自己觉得"有用"的东西**。

想来想去，写了个密码强度检测 —— 输入密码，告诉你是强还是弱。逻辑简单，又能练到输入输出、循环、字符串处理，挺适合当第一个练手项目的。

## 我写出来的东西

```python
while True:
	password = input("清输入你的密码(输入exit退出):")


	if password == "exit":
 	    print("退出程序")
 	    break


	length = len(password)
	has_digit = False
	has_alpha = False


	for char in password:
	    if char.isdigit():
	        has_dight = True
	    elif char.isalpha():
	        has_alpha = True


	if length >= 8 and has_dight and has_alpha:
	    print("密码强度：强")
	else:
	    print("密码强度：弱，建议更改！")
```

思路是这样的：

1. 用 `while True` 让它一直循环，不要跑一次就退出
2. 让用户输入密码，输入 `exit` 就退出
3. 拿两个布尔变量记录"有没有数字""有没有字母"
4. 遍历密码的每一个字符，发现有数字就把 `has_digit` 设成 `True`，发现有字母就把 `has_alpha` 设成 `True`
5. 最后判断：长度够 8 位、有数字、有字母 → 强密码

写的时候还挺得意的，逻辑挺清晰嘛。

## 试了几个密码，发现了两种情况

**先试 `abcd1234`** —— 有字母有数字，长度 8 位：

```
密码强度：强
```

正常。

**再试 `abcdefgh`** —— 只有字母、没有数字，按我的规则应该判"弱"：

```
请输入你的密码(输入exit退出):abcdefgh
Traceback (most recent call last):
  File "check_pwd.py", line 22, in <module>
    if length >= 8 and has_dight and has_alpha:
                       ^^^^^^^^^
NameError: name 'has_dight' is not defined. Did you mean: 'has_digit'?
```

**程序直接崩溃了。**

## 找 bug 的过程

一开始我以为是 `for` 循环写错了，就加了个 `print` 想看看每次循环发生了什么：

```python
for char in password:
    if char.isdigit():
        has_dight = True
    elif char.isalpha():
        has_alpha = True
    print(char, has_dight, has_alpha)
```

跑到第一个字符 `a`，又崩了 —— **`NameError: name 'has_dight' is not defined`**。

奇怪，我明明在 `if char.isdigit():` 里给 `has_dight` 赋过值了啊。

盯着看了半天，终于发现：

```python
length = len(password)
has_digit = False     # ← 开头定义的是 has_digit
has_alpha = False

for char in password:
    if char.isdigit():
        has_dight = True    # ← 循环里写成了 has_dight！
```

**我把 `digit` 打成了 `dight`** —— 少了一个字母 `i`。

## 为什么会崩溃

这才是真正关键的地方。

`has_dight = True` 这行代码**写在 `if char.isdigit():` 里面**。也就是说：

**只有当密码里出现数字时，这个变量才会被创建。**

所以：

| 输入的密码 | 循环里的情况 | 最后判断时 |
| --- | --- | --- |
| `abcd1234`（有数字） | 遇到 `1` 时执行了 `has_dight = True`，变量被创建 | 变量存在，正常判断 |
| `abcdefgh`（无数字） | `if char.isdigit()` 永远不成立，这行从没执行过 | 变量不存在，`NameError` 崩溃 |

而且报错信息里 Python 还很贴心地提示了：

```
NameError: name 'has_dight' is not defined. Did you mean: 'has_digit'?
```

**它其实已经告诉我正确拼写了**，只是我当时没看懂那行提示是什么意思。

## 那拼写错误本身有没有影响？

说实话 —— **没有影响**。

因为判断条件用的是 `has_dight`：

```python
if length >= 8 and has_dight and has_alpha:
```

它在循环里确实被正确设成了 `True`，所以对**含数字的密码**，判断结果是对的。

`has_digit` 那个变量从头到尾都是 `False`，但**根本没人用它**，所以它错了也无所谓。

**真正炸掉的条件比我当时以为的窄：密码长度至少 8 位、而且没有数字时，变量才会从未创建就被读取。** 如果长度不到 8，`and` 会短路，Python 不会继续读取 `has_dight`，程序会直接给出“弱”的结果，不会触发这个 `NameError`。

我原本以为"少写一个字母会导致判断失效"，实际不是。**拼写不一致的真正危害是：你以为在用 `has_digit`，实际用的是另一个变量，而这个变量只在特定情况下才存在。**

修好之后（两处统一成 `has_digit`）就正常了：

| 密码 | 修复前 | 修复后 |
| --- | --- | --- |
| `abcd1234` | 强 | 强 |
| `abcdefgh` | 崩溃 | 弱，建议更改！ |
| `12345678` | 弱，建议更改！ | 弱，建议更改！ |
| `aaaaaaaa` | 崩溃 | 弱，建议更改！ |

## 其他几个小问题

顺着这次调试，我还发现了几个毛病：

**1. 输入提示有错别字**

```python
password = input("清输入你的密码(输入exit退出):")
```

`清输入` 应该是 `请输入`。这种地方最容易忽略，因为程序照样能跑，只有自己看的时候才觉得别扭。

**2. 缩进混用了 Tab 和空格**

我的代码里，有些行用 Tab 缩进，有些用空格。Python 对缩进敏感，这两种混用早晚会出问题。**建议统一用 4 个空格**，这也是 Python 官方的推荐（PEP 8）。

**3. 没有注释**

过了一周再看，`has_dight` 那个 bug 我盯了半天才反应过来。如果当初写了注释说明"这两个变量是记录密码里有没有数字/字母"，可能一眼就能看出不一致。

## 现在回头看，我学到了什么

写第一个脚本最大的收获不是"学会了写 Python"，而是**知道自己会犯什么样的错**：

**① 变量名不一致，错误会在很远的地方才爆出来**

我一开始以为"打错字母只是小事"，但真正的问题不是打错，而是**打错之后，这个变量只在特定分支里才存在**。

`has_dight` 只在"遇到数字"时才被创建。所以：

- 密码有数字 → 程序正常，bug 一直藏着
- 密码长度至少 8 位但没有数字 → 变量不存在 → 崩溃

**结论：变量该在循环外面先定义好，别在分支里"就地创建"。** 如果我在开头写一句 `has_dight = False`，这个 bug 就只会变成"判断结果不对"，而不会整个程序崩掉 —— 而且那种错误更容易被发现。

**② 一定要测"边界"和"反例"**

这个 bug 是靠 `abcdefgh` 抓出来的 —— 一个**没有数字**的密码。

我一开始试的是 `abcd1234` 和 `12345678`，两个里面都有数字，所以程序全都能跑，看起来一切正常。

**结论：不能只测"正常情况"，要专门去测极端和反常的输入 —— 全字母、全数字、空字符串、超长、带空格。** 这类输入最容易把藏起来的分支问题逼出来。

**③ 报错信息要读完，尤其是最后一句**

崩掉的时候 Python 其实已经告诉我答案了：

```
NameError: name 'has_dight' is not defined. Did you mean: 'has_digit'?
```

**最后那句 `Did you mean: 'has_digit'?` 就是在说"你是不是想写 has_digit"。**

我当时扫了一眼就划过去了，只顾着往前翻代码。**新手最容易犯的错之一，就是看到一堆报错就慌，不看具体内容。**

**④ 加 print 是最原始的调试方法，但真的管用**

出问题的时候我在循环里加了一行 `print`，立刻就暴露了变量名的错误。虽然后来学会了用 IDE 的断点调试，但 `print` 到现在还是我最常用的手段。

**⑤ 修 bug 的时候，很容易改出新 bug**

这篇文章发出来之后，我把脚本改了一遍。本意是修那个 `has_dight`，结果**我又搞出了一个新问题**。

我改了判断那一行：

```python
if length >= 8 and has_digit and has_alpha:    # 改对了：has_digit
```

但循环里那行**忘了改**：

```python
for char in password:
    if char.isdigit():
        has_dight = True     # 还是 has_dight
```

于是变成：

- 循环里辛辛苦苦给 `has_dight` 赋值
- 判断的时候去看 `has_digit` —— 它永远是 `False`
- **结果：所有密码都被判成「弱」**

专门测了一下：

| 密码 | 应该的结果 | 改完之后 |
| --- | --- | --- |
| `abcd1234` | 强 | 弱 |
| `ABCdef12` | 强 | 弱 |

崩溃是修好了，但判断全错了。

**结论：改一个变量名，要把所有出现的地方一起改。** 靠眼睛找很容易漏，所以才有 IDE 的"重命名符号"功能 —— 它会把所有引用一起改掉，比手动改安全得多。

**⑥ 有 bug 的代码也值得留着**

那个脚本至今还躺在我的仓库里。

因为它是我的第一份代码。以后写的东西多了，可能想不起来当初是怎么从零开始的 —— 留着它，能提醒我自己，`NameError` 和拼写错误是每个人都会经历的事。

---

*相关代码：[python-learning/check_pwd.py](https://github.com/Tprme/python-learning/blob/main/check_pwd.py)*
