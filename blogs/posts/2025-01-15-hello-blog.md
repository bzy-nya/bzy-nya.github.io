
Welcome to my blog! This post serves as both a **welcome message** and a comprehensive demonstration of all the Markdown styling features supported on this blog. Whether you're here to see what the blog can do or just exploring the content, you'll find examples of every formatting option available.

## Text Formatting Examples

Let's start with the basics - text formatting:

### Basic Text Styles

- **Bold text** using `**bold**` or `__bold__`
- *Italic text* using `*italic*` or `_italic_`
- ***Bold and italic*** using `***bold italic***`
- ~~Strikethrough text~~ using `~~strikethrough~~`
- `Inline code` using backticks
- Regular text for comparison

### Emphasis and Highlights

> **Important Note**: This is how we can emphasize important information using blockquotes and bold text.

You can also combine *italics* with **bold** text in the same sentence to create **_really emphasized_** content.

# H1 Header - Post Title
## H2 Header - Section Title  
### H3 Header - Subsection

## Lists and Organization

### Unordered Lists

Here are different ways to create lists:

- First level item
- Another first level item
  - Second level item
  - Another second level
    - Third level item
    - More third level
      - Fourth level (getting deep!)
- Back to first level

### Ordered Lists

1. First item in ordered list
2. Second item
   1. Nested ordered item
   2. Another nested item
      1. Deep nesting level 3
      2. More deep nesting
3. Back to main level
4. Final item

### Task Lists

- [x] Completed task
- [x] Another completed item  
- [ ] Pending task
- [ ] Another pending item
  - [x] Sub-task completed
  - [ ] Sub-task pending

## Code Examples

### Inline Code

When discussing programming, you might mention `variables`, `functions()`, or `classes.methods()`.

### Code Blocks

Here's a Python function with syntax highlighting:

```python
def lovasz_local_lemma_demo(events, dependencies):
    """
    Demonstrate the Lovász Local Lemma algorithm
    with proper error handling and documentation.
    """
    import random
    from typing import List, Dict, Set
    
    def calculate_probability(event_id: int) -> float:
        # Complex probability calculation
        base_prob = 1.0 / (2 ** len(dependencies[event_id]))
        return min(base_prob, 0.5)
    
    # Main algorithm loop
    max_iterations = 1000
    for iteration in range(max_iterations):
        violated_events = check_violations(events)
        
        if not violated_events:
            print(f"✅ Solution found in {iteration} iterations!")
            return True
            
        # Resample violated events
        for event in violated_events:
            resample_event(event)
    
    return False  # Failed to find solution

# Usage example
if __name__ == "__main__":
    events = initialize_events(num_events=100)
    dependencies = build_dependency_graph(events)
    success = lovasz_local_lemma_demo(events, dependencies)
```

JavaScript example:
```javascript
// Modern JavaScript with async/await
async function fetchBlogPosts() {
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();
        
        return posts.map(post => ({
            id: post.id,
            title: post.title,
            excerpt: post.content.substring(0, 150) + '...',
            publishDate: new Date(post.date).toLocaleDateString()
        }));
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        return [];
    }
}
```

Shell/Bash commands:
```bash
# Git workflow for blog posts
git checkout -b new-blog-post
echo "# New Post Title" > posts/new-post.md
git add posts/new-post.md
git commit -m "feat: add new blog post draft"
git push origin new-blog-post

# Server management
sudo systemctl restart nginx
tail -f /var/log/nginx/access.log
```

## Mathematical Content

### Inline Mathematics

The Lovász Local Lemma states that if each event $A_i$ has probability at most $p$ and is independent of all but at most $d$ other events, and if $ep(d+1) \leq 1$, then $\Pr[\bigcap_i \overline{A_i}] > 0$.

### Display Mathematics

Here's the full equation of the Lovász Local Lemma:

$$\begin{equation}\Pr\left[\bigcap_{i=1}^n \overline{A_i}\right] \geq \prod_{i=1}^n (1 - p_i)\end{equation}\tag{LLL}$$

More complex mathematical expressions:

$$\sum_{k=0}^n \binom{n}{k} x^k y^{n-k} = (x + y)^n$$

$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$

Matrix notation:
$$
\begin{pmatrix}
a & b \cr
c & d
\end{pmatrix}
\begin{pmatrix}
x \cr
y
\end{pmatrix}=
\begin{pmatrix}
ax + by \cr
cx + dy
\end{pmatrix}
$$

Multiple line equation:

$$
\begin{align*}\mathbb{E}[\gamma_i]&=\sum_{j=0}^\infty \frac{1}{n}\sum_{r=0}^{n-1}\omega_n^{(j-i)r}[z^{j}]G(z)\\ &=\frac{1}{n}\sum_{r=0}^{n-1}\omega_n^{-ri}\sum_{j=0}^\infty\omega_n^{rj}[z^j]G(z)\\ &=\frac{1}{n}\sum_{r=0}^{n-1}\omega_n^{-ri} G(\omega_n^r)\end{align*}
$$

## Tables

### Simple Table

| Algorithm | Time Complexity | Space Complexity | Stable |
|-----------|----------------|------------------|--------|
| Merge Sort | $O(n \log n)$ | $O(n)$ | Yes |
| Quick Sort | $O(n \log n)$ | $O(\log n)$ | No |
| Heap Sort | $O(n \log n)$ | $O(1)$ | No |
| Bubble Sort | $O(n^2)$ | $O(1)$ | Yes |

### Table with Alignment

| Left Aligned | Center Aligned | Right Aligned | Description |
|:------------|:-------------:|-------------:|:-------------:|
| Data Structure | Performance | Memory | Use Case |
| Array | $O(1)$ access | Low | Random access needed |
| Linked List | $O(n)$ search | Medium | Frequent insertions |
| Hash Table | $O(1)$ average | High | Key-value mappings |
| Binary Tree | $O(\log n)$ | Medium | Ordered data |

## Blockquotes and Citations

### Simple Blockquote

> "The best way to learn algorithms is to implement them yourself, make mistakes, debug them, and understand why they work."

### Academic Citation Style

> "The probabilistic method is a nonconstructive method, primarily used in combinatorics and pioneered by Paul Erdős, for proving the existence of a prescribed kind of mathematical object."
> ::align(right)
> — *The Probabilistic Method*, Noga Alon and Joel H. Spencer
> ::

## Links and References

### Different Types of Links

- [Internal link to another post](#)
- [External link to GitHub](https://github.com)
- [Link with title](https://example.com "This is a title")
- Email link: <contact@example.com>
- Automatic URL conversion: https://www.google.com

### Reference-style Links

This is [a reference link][ref1] and here's [another one][ref2].

[ref1]: https://github.com "GitHub Homepage"
[ref2]: https://stackoverflow.com "Stack Overflow"

## Images and Media

### Local Images
![Kawaiiiiiiiiiiii](../../asset/image/头像.jpeg "Kawaiiiiiiiiiiii!")

### External Images with Different Sizes

![Placeholder Image](https://picsum.photos/200 "A placeholder image 200x200")
![Placeholder Image](https://picsum.photos/200/300 "A placeholder image 200x300")

### Video

::video[3Blue1Brown : Transformers, the tech behind LLMs | Deep Learning Chapter 5 ](https://www.youtube.com/watch?v=wjZofJX0v4M)

::video[Bad apple!!!](https://www.bilibili.com/video/BV1xx411c79H)

## Horizontal Rules

---

***

___

## Alignment

::align(right)
✨ Text from the right, so sparkly and cute! ✨
::

::align(center)
(｡♥‿♥｡) Text in the center, super kawaii!
::

::align(left)
UwU~ Text from the left, overflowing with cuteness!
::

::align(right){dir=rtl,text=1}
هذا نص عربي مع اتجاه RTL
::

::align(center){writing=vertical-rl,orient=upright,text=1}
金樽清酒斗十千，玉盘珍羞直万钱。

停杯投箸不能食，拔剑四顾心茫然。

欲渡黄河冰塞川，将登太行雪满山。

闲来垂钓碧溪上，忽复乘舟梦日边。

行路难，行路难，

多歧路，今安在？

长风破浪会有时，直挂云帆济沧海。 

李白《行路难》
::

::align(right){width=60%}
五月雨を
::
::align(right){width=55%}
集めて涼し 
::
::align(right){width=45%}
最上川
::

## Further Features

### Footnotes

This text has a footnote[^1] and another one[^2].

[^1]: This is the first footnote content. You can write multiple paragraphs here.

[^2]: This is the second footnote. Footnotes are automatically numbered and linked.