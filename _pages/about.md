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
# 🙋‍♂️ <font color="#4A708B">About Me</font>

Here is **Yuhao Wu**. I am a PhD student in the [School of Geodesy and Geomatics](https://www.sgg.whu.edu.cn/) at the [Wuhan University](https://en.whu.edu.cn/). My research interests includes GNSS-Transmission hydrology (meteorology, tropospheric modeling, and weather forecasting). <br>

<div><img src="/images/GNSS.jpg"></div>
<font color="#ABABAB">Conceptual framework of GNSS hydrology (Wan et al., 2025).</font><br>


<div class='paper-box'><div class='paper-box-image'><div><div class="badge">CIMSS</div><img src='images/latest.png' alt="sym" width="120%"></div></div>
<div class='paper-box-text' markdown="1">
Real-time water vapor from the CIMSS (Wimmers & Velden, 2011)

- My current research focus is on water vapor retrieval based on GNSS and remote sensing. 
- In a word, advanced technologies like GNSS influence the life of everybody.  I wish to devote my talent to this meaningful cause and bring well-being to society.
</div>
</div>

I have published more than 10 papers with total <a href='https://scholar.google.com/citations?user=RlAdMyYAAAAJ&hl=zh-CN'>google scholar citations <strong><span id='total_cit'>110+</span></strong></a>. If you are interested in any aspect of me, I am always open to discussions and collaborations. Feel free to reach out to me at - <u>wyhnbnb@126.com</u>

**<font color="#990000">I am actively seeking a position as a university lecturer in 2028. If you have any information, please contact me!</font>**

# 🔥 <font color="#4A708B">News</font>
- *2025.11*: &nbsp;🎉🎉 Our team won the second prize in the [2025 China post-graduate mathematical contest in modeling](https://cpipc.acge.org.cn//cw/detail/4/2c9080179ab48607019ab53c045a01a9) (Top 4%). 
- *2025.10*: &nbsp;🎉🎉 Very pleased to receive the Top Ten Student Editor Award from 《Satellite Navigation》! 
- *2024.11*: &nbsp;🎉🎉 Our team won the second prize in the [2024 China post-graduate mathematical contest in modeling](https://cpipc.acge.org.cn//cw/detail/4/2c9080159353177f0193536864dc0048) (Top 4%). 
- *2024.09*: &nbsp;🎉🎉 Very happy to continue my doctoral studies in engineering at Wuhan University! 
- *2024.06*: &nbsp;🎉🎉 Very excited to get a Master's degree in Science at Shandong University!
- *2023.12*: &nbsp;🎉🎉 Very excited to be selected as Outstanding Graduate of Shandong University!
- *2023.11*: &nbsp;🎉🎉 Very pleased to be awarded the National Scholarship at Shandong University!

# 📝 <font color="#4A708B">Publications</font>
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

<div class='paper-box'><div class='paper-box-image'><div><div class="badge">EJRS</div><img src='images/EJRS.jpg' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
[Revealing the water vapor transport during the Henan "7.20" heavy rainstorm based on ERA5 and real-time GNSS](https://doi.org/10.1016/j.ejrs.2024.02.004)

**Yuhao Wu**, Nan Jiang, Yan Xu#, et al., 2024. *Egyptian Journal of Remote Sensing and Space Sciences*. 27, 165-177. (JCR Q2, IF=4.4).<br>
- Different from the normal rainfall, we found that the PWV variation during the Henan rainstorm experienced a unique "accumulation" period.
- In addition, the PWV in the severely damaged area was 20 mm higher than the average value of the past decade. Ten days after the rainstorm, the surface of this area had subsided by 1.5-3 mm.
</div>
</div>

<div class='paper-box'><div class='paper-box-image'><div><div class="badge">GRL</div><img src='images/GRL.jpg' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
[First PWV Retrieval using MERSI-LL onboard FY-3E and Cross Validation with Co-platform Occultation and Ground GNSS](https://doi.org/10.1029/2024GL108681)

Nan Jiang†, **Yuhao Wu†**, Song Li, Yan Xu#, et al., 2024. *Geophysical Research Letters*. 51, e2024GL108681. (JCR Q1, IF=5.3).<br>
- Here, we carry out the PWV retrieval using the MERSI-LL sensor onboard the FY-3E satellite for the first time.
- For the results against ground-based GNSS, the total accuracy shows an RMSE of 2.69-3.36 mm as the clouds increase, and correlation coefficients higher than 0.95.
</div>
</div>

<div class='paper-box'><div class='paper-box-image'><div><div class="badge">ESS</div><img src='images/ESS.jpg' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
 [PWV retrieval performance evaluation for the fresh BDS-3 with multi-source data](https://doi.org/10.1029/2023EA002923)
 
 Nan Jiang, Zhaorui Gao, **Yuhao Wu**, et al., 2023. *Earth and Space Science*. 10, e2023EA002923. (JCR Q2, IF=3.1). <br>
- From the tests applied with different satellite systems, we found that BDS-3 has a comparable PWV retrieval performance as global positioning system (GPS), and a better outcome was achieved using the combined data from GPS and BDS-3.
</div>
</div>

- Yubo Wang, Nan Jiang, **Yuhao Wu**, Yan Xu#, et al., 2024. An Improved Model for the Retrieval of Precipitable Water Vapor in All Weather Conditions (RCMNT) Based on NIR and TIR Recordings of MODIS. *IEEE Transactions on Geoscience and Remote Sensing*. 62, 1-12 (JCR Q1, IF=8.2). [PDF](https://doi.org/10.1109/TGRS.2024.3381750) <br>

- Ao Guo, Yan Xu, Nan Jiang#, **Yuhao Wu**, et al., 2023. Analyzing correlations between GNSS retrieved precipitable water vapor and land surface temperature after earthquakes occurrence. *Science of The Total Environment*. 872, 162225-162225 (IF=9.8). [PDF](https://doi.org/10.1016/j.scitotenv.2023.162225) <br>

-	Ranran Jia, Nan Jiang#, Yan Xu, **Yuhao Wu**, Zeqi Li, Tianhe Xu, 2025. Shipborne GNSS water vapor anomaly diagnosis and its response to typhoons saola and haikui. *Advances in Space Research*, S0273117725000778. (JCR Q1, IF=2.8). [PDF](https://doi.org/10.1016/j.asr.2025.01.047) <br>

-	Ao Guo, Nan Jiang, Yan Xu#, Tianhe Xu, **Yuhao Wu**, et al., 2023. Co-seismic characterization analysis in PWV and land-atmospheric observations associated with Luding Ms 6.8 earthquake occurrence in China on September 5, 2022, Geomatics, *Natural Hazards and Risk*. 14:1 (JCR Q1, IF=4.2). [PDF](https://doi.org/10.1080/19475705.2023.2279494) <br>

-	Nan Jiang, Zhaorui Gao, Yan Xu, Tianhe Xu#, Ao Guo, **Yuhao Wu**, et al., 2023. Response analysis on multi-parameters in the 2022 Tonga volcanic eruption using satellite-ground combined data. *Journal of Geophysical Research: Atmospheres*. 128.e2023JD038839 (JCR Q2, IF=4.4). [PDF](https://doi.org/10.1029/2023JD038839) <br>

-	Zhaorui Gao, Nan Jiang, Yan Xu#, Tianhe Xu, Ao Guo, **Yuhao Wu**, 2023. A Spatial PWV Retrieval Model Over Land for GCOM-W/AMSR2 Using Neural Network Method: A Case in the Western United States. *IEEE Journal of Selected Topics in Applied Earth Observations and Remote Sensing*. 16, 2954-2962 (JCR Q1, IF=5.5). [PDF](https://doi.org/10.1109/JSTARS.2023.3255259) <br>

-	Song Li, Nan Jiang, Tianhe Xu#, Yan Xu, Honglei Yang, Zhen Zhang, Ao Guo, **Yuhao Wu**, 2023. A precipitation forecast model with a neural network and improved GPT3 model for Japan. *GPS Solutions*. 27, 186 (JCR Q2, IF=4.9). [PDF](https://doi.org/10.1007/s10291-023-01526-1) <br>

-	Song Li, Nan Jiang, Tianhe Xu#, Honglei Yang, Ao Guo, **Yuhao Wu**, Yan Xu, 2024. Tightly Coupled Tomography Model for Atmospheric Water Vapor Based on Multisource Remote-Sensing and GNSS Data. *IEEE Transactions on Geoscience and Remote Sensing*. 62, 1-16 (JCR Q1, IF=8.2). [PDF](https://doi.org/10.1109/TGRS.2024.3393561) <br>


## Software Copyright
<div class='paper-box'><div class='paper-box-image'><div><div class="badge">GPRA</div><img src='images/software1.jpg' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
Batch retrieval software for water vapor based on Beidou/GNSS

Yan Xu, **Yuhao Wu**, Nan Jiang, Tianhe Xu. 2022. 2023SR0222849.<br>
- Support reading of various raw ZTDs such as RTKLIB, Bernese, IGS, RPNT, etc.
- Quality control of raw ZTD based on dual median filtering algorithm.
</div>
</div>

<div class='paper-box'><div class='paper-box-image'><div><div class="badge">GWR</div><img src='images/software2.jpg' alt="sym" width="100%"></div></div>
<div class='paper-box-text' markdown="1">
GNSS-SNR water level retrieval software

**Yuhao Wu**, Dongliang Guan. 2021. 2021SR1211116.<br>
- Suitable for multiple systems such as BDS and GPS.
- Retrieval based on EMD algorithm.
</div>
</div>

## Patent
- Method and System for Monitoring Extraordinary Rainstorm on Basis of Multi-source Data. Nan Jiang, **Yuhao Wu**, Yan Xu, Tianhe Xu. 2023. Patent No.: US 11,852,779B1.<br>
- A method for completing missing meteorological monitoring data. Yifan Wang, Hui Zhang, Guofang Wang, **Yuhao Wu**, Yi Ma, Bao Zhang, et al. 2025. Patent No.: ZL 2025 1 0725640.7.<br>


## Degree Thesis

- **Master's thesis:** Research and Application of Water Vapor Retrieval by Integrating Ground-based GNSS and Spaceborne Thermal Infrared Remote Sensing Data. <br>

- **Bachelor's thesis:** Research on Water Level Change Monitoring Based on BeiDou Navigation Satellite System. Excellent Graduation Thesis Award of Nanjing Tech University. First Prize for Outstanding Graduation Thesis of Undergraduate Geomatics Students in Jiangsu Province.<br>

<span class='anchor' id='-honors-and-awards'></span>
# 🏆️ <font color="#4A708B">Honors and Awards</font>

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
- *2025.11*: Second prize in the China post-graduate mathematical contest in modeling (Top 4%) (**National Level**) 
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

# 📖 <font color="#4A708B">Educations</font>
- *2024.09 - 2028.06 (now)*, Wuhan University, Geodesy and Geomatics Engineering, PhD in Engineering. 
- *2021.09 - 2024.06*, Shandong University, Master of Science in Geophysics.
- *2017.09 - 2021.06*, Nanjing Tech University, Bachelor of Engineering in Geodesy and Geomatics. 

# 💬 <font color="#4A708B">Invited Talks</font>

- **Oral:** Analysis of a heavy rainstorm process in Henan, China based on multi-source data. *The XVIII International Congress for Mine Surveying. Xuzhou, China, October 27, 2022*<br>
- **Oral:** Generation of High-Precision Water Vapor Products Based on GNSS and Morphed Integrated Microwave Imagery. *2025 Annual Meeting on Geodesy and Navigation. Qingdao, China, 2025.5.17*<br>
- **Poster:** Landsat 8 TIRS Water Vapor Retrieval Based on SWCVR Algorithm and Ensemble Machine Learning. *5th Congress of China Geodesy and Geophysics, 5th CCGG. Wuhan, China, 2023.4.22*<br>


# 💻 <font color="#4A708B">Internships</font>
- From July 2018 to September 2018, I worked as a first grade homeroom teacher (volunteer teaching) at Hanwang Town Second Primary School in Mianzhu City, Sichuan Province, China.
- Since December 2024, I have been serving as a part-time student editor for the journal 《Satellite Navigation》.<br>

<span class='anchor' id='-hobbies'></span>
# 📷 <font color="#4A708B">Hobbies</font>

## Photography

<div>
<img src="/images/photo1.jpg">
</div>
<font color="#ABABAB">The sunset outside the window of the tallest building at Shandong University (Weihai).</font><br>Photography opened the door to a new world for me: I began to observe the weather, the timing of the rise and fall of the sun and moon, the forecast of sunset, meteors, and the Milky Way. **To see the world, things dangerous to come to, to see behind walls, to draw closer, to find each other and to feel. That is the purpose of life.**<br>
<div>
<img src="/images/photo2.jpg">
</div>
<br>During my three years in Weihai, I took many meaningful photos and made some friends who took photos together. My camera is *Nikon Z50*, with lenses of *50-250 mm* and *16-50 mm*. In addition, I also have an *Olympus IS-5000* film camera. But in the past year, I have hardly touched them because I have devoted all my time to scientific research.<br>If you like the style of my photos, then we might be kindred spirits.

## Past Hobbies

<div>
<img src="/images/paint1.jpg">
</div>
<font color="#ABABAB">I drew it in high school.</font>
Before going to college, I was studying sketching and almost became an art student.

<span class='anchor' id='-visitor-map'></span>
# 🌏️ <font color="#4A708B">Visitor Map</font>

<script type='text/javascript' id='clustrmaps' src='//cdn.clustrmaps.com/map_v2.js?cl=375e86&w=370&t=tt&d=6gCLp8H0jUJXTDAgwenOxbDgCEaAvQc8Hgj55t1cF1k&co=9ecdee&cmo=ffbdf7&cmn=fffc2e&ct=000000'></script>