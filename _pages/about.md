---
permalink: /
title: ""
excerpt: ""
author_profile: true
redirect_from: 
  - /about/
  - /about.html
---

{% if site.google_scholar_stats_use_cdn %}
{% assign gsDataBaseUrl = "https://cdn.jsdelivr.net/gh/" | append: site.repository | append: "@" %}
{% else %}
{% assign gsDataBaseUrl = "https://raw.githubusercontent.com/" | append: site.repository | append: "/" %}
{% endif %}
{% assign url = gsDataBaseUrl | append: "google-scholar-stats/gs_data_shieldsio.json" %}

<span class='anchor' id='about-me'></span>

Here is **Yuhao Wu**. I am a PhD student in the [School of Geodesy and Geomatics](https://www.sgg.whu.edu.cn/) at the [Wuhan University](https://en.whu.edu.cn/). My research interests includes GNSS meteorology, tropospheric modeling, and weather forecasting. My current research focus is on water vapor retrieval based on GNSS and remote sensing. In a word, advanced technologies like GNSS influence the life of everybody.  I wish to devote my talent to this meaningful cause and bring well-being to society.

I have published more than 10 papers at the journals with total <a href='https://scholar.google.com/citations?user=RlAdMyYAAAAJ&hl=zh-CN'>google scholar citations <strong><span id='total_cit'>50+</span></strong></a>. If you are interested in any aspect of me, I am always open to discussions and collaborations. Feel free to reach out to me at - wyhnbnb@126.com

**<font color="#990000">I am actively seeking a position as a university lecturer in 2028. If you have any information, please contact me!</font>**

# 🔥 News
- *2024.11*: &nbsp;🎉🎉 Our team won the second prize in the [China post-graduate mathematical contest in modeling](https://cpipc.acge.org.cn//cw/detail/4/2c9080159353177f0193536864dc0048) (Top 4%). 
- *2024.09*: &nbsp;🎉🎉 Very happy to continue my doctoral studies in engineering at Wuhan University! 
- *2024.06*: &nbsp;🎉🎉 Very excited to get a Master's degree in Science at Shandong University!
- *2024.02*: &nbsp;🎉🎉 My research paper on rainstorm in Henan has been accepted by EJRS!
- *2023.12*: &nbsp;🎉🎉 Very excited to be selected as Outstanding Graduate of Shandong University!
- *2023.11*: &nbsp;🎉🎉 Very pleased to be awarded the National Scholarship at Shandong University!

# 📝 Publications 
> (†: equal contribution, #: corresponding author)

## Research Paper
<div class='paper-box'><div class='paper-box-image'><div><div class="badge">JAG</div><img src='images/landsat.png' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
[Improving the capability of water vapor retrieval from Landsat 8 using ensemble machine learning](https://doi.org/10.1016/j.jag.2023.103407)

**Yuhao Wu**, Nan Jiang, Yan Xu#, et al., 2023. *International Journal of Applied Earth Observation and Geoinformation*. 122, 103407. (JCR Q1, IF=7.5).<br>

- The new method uses Gradient Boosting Decision Tree (GBDT) to establish the model between brightness temperature, GNSS-derived PWV, and related surface parameters. 
- Compared with SWCVR, the GBDT improves the RMSE and availability by 41.99% and 38.3%, respectively.

</div>
</div>

<div class='paper-box'><div class='paper-box-image'><div><div class="badge">EJRS</div><img src='images/EJRS.png' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
[Revealing the water vapor transport during the Henan "7.20" heavy rainstorm based on ERA5 and real-time GNSS](https://doi.org/10.1016/j.ejrs.2024.02.004)

**Yuhao Wu**, Nan Jiang, Yan Xu#, et al., 2024. *Egyptian Journal of Remote Sensing and Space Sciences*. 27, 165-177. (JCR Q2, IF=4.4).<br>
- Different from the normal rainfall, we found that the PWV variation during the Henan rainstorm experienced a unique "accumulation" period.
- In addition, the PWV in the severely damaged area was 20 mm higher than the average value of the past decade. Ten days after the rainstorm, the surface of this area had subsided by 1.5-3 mm.
</div>
</div>

<div class='paper-box'><div class='paper-box-image'><div><div class="badge">GRL</div><img src='images/GRL.png' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
[First PWV Retrieval using MERSI-LL onboard FY-3E and Cross Validation with Co-platform Occultation and Ground GNSS](https://doi.org/10.1029/2024GL108681)

Nan Jiang†, **Yuhao Wu†**, Song Li, Yan Xu#, et al., 2024. *Geophysical Research Letters*. 51, e2024GL108681. (JCR Q1, IF=5.3).<br>
- Here, we carry out the PWV retrieval using the MERSI-LL sensor onboard the FY-3E satellite for the first time.
- For the results against ground-based GNSS, the total accuracy shows an RMSE of 2.69-3.36 mm as the clouds increase, and correlation coefficients higher than 0.95.
</div>
</div>

<div class='paper-box'><div class='paper-box-image'><div><div class="badge">ESS</div><img src='images/ESS.png' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
 [PWV retrieval performance evaluation for the fresh BDS-3 with multi-source data](https://doi.org/10.1029/2023EA002923)
 
 Nan Jiang, Zhaorui Gao, **Yuhao Wu**, et al., 2023. *Earth and Space Science*. 10, e2023EA002923. (JCR Q2, IF=3.1). <br>
- From the tests applied with different satellite systems, we found that BDS-3 has a comparable PWV retrieval performance as global positioning system (GPS), and a better outcome was achieved using the combined data from GPS and BDS-3.
</div>
</div>

## Patent
- Method and System for Monitoring Extraordinary Rainstorm on Basis of Multi-source Data. Nan Jiang, **Yuhao Wu**, Yan Xu, Tianhe Xu. 2023. Patent No.: US 11,852,779B1.<br>

## Software Copyright
- [Batch retrieval software for water vapor based on Beidou/GNSS](https://b23.tv/1DP5ixu)<br>Yan Xu, **Yuhao Wu**, Nan Jiang, Tianhe Xu. 2022. 2023SR0222849.<br>

- [GNSS-SNR water level retrieval software](https://b23.tv/8GL6OGN)<br>**Yuhao Wu**, Dongliang Guan. 2021. 2021SR1211116.<br>

## Degree Thesis

- **Master's thesis:** Research and Application of Water Vapor Retrieval by Integrating Ground-based GNSS and Spaceborne Thermal Infrared Remote Sensing Data. (Advisor: Dr. [Yan Xu](https://apd.wh.sdu.edu.cn/info/1510/1912.htm)). <br>

- **Bachelor's thesis:** Research on Water Level Change Monitoring Based on BeiDou Navigation Satellite System. (Advisor: Dr. [Dongliang Guan](https://cge.njtech.edu.cn/info/1045/2861.htm)). Excellent Graduation Thesis Award of Nanjing Tech University. First Prize for Outstanding Graduation Thesis of Undergraduate Geomatics Students in Jiangsu Province.<br>


# 🎖 Honors and Awards

## Scholarships

- *2023.11*: **National Scholarship for Master's Students** (¥20000)<br>
- *2024.09*: Doctoral Basic Scholarship at Wuhan University (¥10000)<br>
- *2022.10*: Second Class Scholarship at Shandong University (¥3200)<br>
- *2021.11*: Third Prize of Outstanding Graduate Student Source Award Fund at Shandong University (¥4000)<br>
- *2021.10*: Freshman Scholarship at Shandong University (¥3200)<br>
- *2019.10*: Guoheng Scholarship (¥2000) Established by Guoheng Group
- *From 2017 to 2021*: First prize scholarship at NJtech (¥3200, **Four times**)
- *From 2017 to 2021*: Special scholarship at NJtech (¥1600)

## Competitions

- *2024.11*: Second prize in the China post-graduate mathematical contest in modeling (Top 4%) (**National Level**) 
- *2019.11*: Second Prize in the Remote Sensing Processing Group of the 11th National College GIS Skills Competition (**National Level**) 
- *2021.05*: First Prize of Jiangsu Province in the 12th Beidou Cup National Youth Science and Technology Innovation Competition (**Provincial Level**) 
- *2020.04*: Excellent Award in the 7th "Sharing Cup" College Student Science and Technology Sharing Service Innovation Competition (**National Level**) 
- *2022.04*: Second Prize in Track B and Third Prize in Track O of the Shandong University Astronomy Association Photography Competition
- *2023.04*: Third Prize in the 5th Graduate Photography Competition of Shandong University
- *2022.12*: Third Prize in Weihai Network Culture Works Competition

## Honors
- *2016.05*: Three Good Students in Yunnan Province (**Provincial Level**)
- *2021.10*: First Prize for Outstanding Graduation Thesis of Undergraduate Geomatics Students in Jiangsu Province (**Provincial Level**)
- *From 2017 to 2021*: Exemplary individual, Excellent Student Cadre, Excellent League Member, Three Good Students, Excellent Volunteers, Excellent Graduates, and Excellent Graduation Design at NJtech (**School Level**) 
- *From 2021 to 2024*: Outstanding Communist Youth League Member, Outstanding Graduate, and Annual Outstanding Graduate Student at Shandong University (**School Level**)<br>

# 📖 Educations
- *2024.09 - 2028.06 (now)*, Wuhan University, Geodesy and Geomatics Engineering, PhD in Engineering. 
- *2021.09 - 2024.06*, Shandong University, Master of Science in Geophysics.
- *2017.09 - 2021.06*, Nanjing Tech University, Bachelor of Engineering in Geodesy and Geomatics. 

# 💬 Invited Talks

- **Oral:** Analysis of a heavy rainstorm process in Henan, China based on multi-source data. *The XVIII International Congress for Mine Surveying, Xuzhou, China, October 27, 2022*<br>
- **Poster:** 基于SWCVR算法和集成机器学习的Landsat 8 TIRS水汽反演研究. *第五届中国大地测量和地球物理学学术大会. 中国武汉, 2023.4.22*<br>

# 💻 Internships
- From July 2018 to September 2018, I worked as a first grade homeroom teacher (volunteer teaching) at Hanwang Town Second Primary School in Mianzhu City, Sichuan Province, China.

# Hobbies