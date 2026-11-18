        // Israeli ATC Reporting Points from AIP and common VFR navigation
        var reportingPointsData = [
            // Key VFR Reporting Points - Central Area
            { name: "LATRUN", lat: 31.8361, lng: 34.9789, type: "VFR" },
            { name: "NESHARIM", lat: 31.9044, lng: 34.8886, type: "VFR" }, // Nesharim Interchange near Ramla
            { name: "AYALON", lat: 31.9167, lng: 34.9333, type: "VFR" }, // Added
            { name: "OVED", lat: 32.0333, lng: 34.9167, type: "VFR" },
            { name: "NETZER", lat: 31.9261, lng: 34.8294, type: "VFR" }, // Netzer Sereni kibbutz
            { name: "YARKON", lat: 32.1167, lng: 34.8333, type: "VFR" }, // Added
            { name: "ALEXANDER", lat: 32.2500, lng: 34.9000, type: "VFR" }, // Added
            
            // Southern Sector - Gaza Envelope
            { name: "GVULOT", lat: 31.2833, lng: 34.4167, type: "VFR" },
            { name: "NITZANA", lat: 30.9167, lng: 34.4167, type: "VFR" },
            { name: "REVIVIM", lat: 31.0000, lng: 34.7000, type: "VFR" },
            { name: "MIZPE REVIVIM", lat: 30.9167, lng: 34.7500, type: "VFR" },
            { name: "RAMAT HOVAV", lat: 31.0167, lng: 34.8167, type: "VFR" },
            { name: "MASHABEI SADEH", lat: 31.0167, lng: 34.9167, type: "VFR" },
            { name: "DVIRA", lat: 31.3000, lng: 34.6833, type: "VFR" },
            { name: "LEHAVIM", lat: 31.3667, lng: 34.8167, type: "VFR" },
            { name: "MEITAR", lat: 31.3333, lng: 34.9500, type: "VFR" },
            { name: "SHANI", lat: 31.4500, lng: 34.7500, type: "VFR" },
            { name: "GILAT", lat: 31.3333, lng: 34.6833, type: "VFR" },
            { name: "PATISH", lat: 31.2833, lng: 34.6333, type: "VFR" },
            { name: "URIM", lat: 31.3500, lng: 34.5000, type: "VFR" },
            { name: "MEFALSIM", lat: 31.3500, lng: 34.5500, type: "VFR" },
            { name: "ALUMIM", lat: 31.4667, lng: 34.5167, type: "VFR" },
            { name: "GEVIM", lat: 31.4333, lng: 34.5500, type: "VFR" },
            { name: "YEVUL", lat: 31.5000, lng: 34.4833, type: "VFR" },
            { name: "KFAR AZA", lat: 31.5167, lng: 34.4667, type: "VFR" },
            { name: "NAHAL OZ", lat: 31.4833, lng: 34.5167, type: "VFR" },
            { name: "SUFA", lat: 31.3500, lng: 34.4667, type: "VFR" },
            { name: "EIN HASHLOSHA", lat: 31.3833, lng: 34.5000, type: "VFR" },
            { name: "REIM", lat: 31.4000, lng: 34.4833, type: "VFR" },
            { name: "NIRIM", lat: 31.3833, lng: 34.4333, type: "VFR" },
            
            // Coastal Sector
            { name: "NITZANIM", lat: 31.7333, lng: 34.6333, type: "VFR" },
            { name: "NITZAN", lat: 31.7500, lng: 34.6667, type: "VFR" },
            { name: "GEDERA", lat: 31.8167, lng: 34.7833, type: "VFR" },
            { name: "MAZKERET BATYA", lat: 31.8500, lng: 34.8500, type: "VFR" },
            { name: "BET DAGAN", lat: 32.0028, lng: 34.8219, type: "VFR" },
            { name: "YAVNE", lat: 31.8667, lng: 34.7500, type: "VFR" },
            { name: "ASERET", lat: 31.7333, lng: 34.7000, type: "VFR" },
            { name: "GAN YAVNE", lat: 31.7833, lng: 34.7167, type: "VFR" },
            { name: "KFAR HABAD", lat: 32.0333, lng: 34.8667, type: "VFR" },
            { name: "AZOR", lat: 32.0167, lng: 34.8167, type: "VFR" },
            { name: "GIVAT SHMUEL", lat: 32.0750, lng: 34.8500, type: "VFR" },
            { name: "KIRYAT ONO", lat: 32.0619, lng: 34.8572, type: "VFR" },
            { name: "OR YEHUDA", lat: 32.0294, lng: 34.8586, type: "VFR" },
            
            // Northern Sector
            { name: "ROSH HANIKRA", lat: 33.0858, lng: 35.1044, type: "VFR" },
            { name: "ACHZIV", lat: 33.0500, lng: 35.1000, type: "VFR" },
            { name: "NAHARIYA", lat: 33.0072, lng: 35.0944, type: "VFR" },
            { name: "AKKO", lat: 32.9278, lng: 35.0833, type: "VFR" },
            { name: "KARMIEL", lat: 32.9167, lng: 35.3000, type: "VFR" },
            { name: "SAFED", lat: 32.9667, lng: 35.4972, type: "VFR" },
            { name: "ROSH PINA", lat: 32.9692, lng: 35.5719, type: "VFR" },
            { name: "TIBERIAS", lat: 32.7947, lng: 35.5308, type: "VFR" },
            { name: "KINNERET", lat: 32.8333, lng: 35.5833, type: "VFR" },
            { name: "MIGDAL", lat: 32.8333, lng: 35.5167, type: "VFR" },
            { name: "GINOSAR", lat: 32.8500, lng: 35.5167, type: "VFR" },
            { name: "BEIT SHEAN", lat: 32.5000, lng: 35.5000, type: "VFR" },
            { name: "AFULA", lat: 32.6167, lng: 35.2833, type: "VFR" },
            { name: "YOKNEAM", lat: 32.6583, lng: 35.1083, type: "VFR" },
            
            // Haifa Area
            { name: "HAIFA BAY", lat: 32.8333, lng: 35.0000, type: "VFR" },
            { name: "HAIFA PORT", lat: 32.8247, lng: 34.9889, type: "VFR" },
            { name: "KISHON", lat: 32.8167, lng: 35.0667, type: "VFR" },
            { name: "ATLIT", lat: 32.6922, lng: 34.9428, type: "VFR" },
            { name: "HADERA POWER STATION", lat: 32.4403, lng: 34.8856, type: "VFR" },
            { name: "CAESAREA", lat: 32.5000, lng: 34.9000, type: "VFR" },
            { name: "OR AKIVA", lat: 32.5167, lng: 34.9167, type: "VFR" },
            { name: "PARDES HANNA", lat: 32.4667, lng: 34.9667, type: "VFR" },
            { name: "BINYAMINA", lat: 32.5200, lng: 34.9589, type: "VFR" },
            { name: "ZICHRON YAAKOV", lat: 32.5667, lng: 34.9500, type: "VFR" },
            
            // Central Coast
            { name: "NETANYA", lat: 32.3333, lng: 34.8500, type: "VFR" },
            { name: "HERZLIYA", lat: 32.1667, lng: 34.8167, type: "VFR" },
            { name: "TEL AVIV MARINA", lat: 32.0833, lng: 34.7667, type: "VFR" },
            { name: "READING POWER STATION", lat: 32.1889, lng: 34.8597, type: "VFR" },
            { name: "JAFFA PORT", lat: 32.0528, lng: 34.7514, type: "VFR" },
            { name: "BAT YAM", lat: 32.0167, lng: 34.7500, type: "VFR" },
            { name: "HOLON", lat: 32.0167, lng: 34.7833, type: "VFR" },
            { name: "RISHON LEZION", lat: 31.9667, lng: 34.8000, type: "VFR" },
            { name: "RAANANA", lat: 32.1833, lng: 34.8667, type: "VFR" },
            { name: "KFAR SABA", lat: 32.1833, lng: 34.9167, type: "VFR" },
            { name: "HOD HASHARON", lat: 32.1500, lng: 34.8833, type: "VFR" },
            
            // Southern Coast
            { name: "PALMACHIM", lat: 31.8889, lng: 34.6972, type: "VFR" },
            { name: "ASHDOD PORT", lat: 31.8167, lng: 34.6333, type: "VFR" },
            { name: "ASHKELON", lat: 31.6667, lng: 34.5667, type: "VFR" },
            { name: "ASHKELON POWER STATION", lat: 31.6833, lng: 34.5500, type: "VFR" },
            { name: "ZIKIM", lat: 31.6333, lng: 34.5167, type: "VFR" },
            { name: "YAVNE YAM", lat: 31.8500, lng: 34.7000, type: "VFR" },
            
            // Central Israel
            { name: "PETAH TIKVA", lat: 32.0883, lng: 34.8878, type: "VFR" },
            { name: "ROSH HAAYIN", lat: 32.0956, lng: 34.9561, type: "VFR" },
            { name: "MODIIN", lat: 31.9000, lng: 35.0167, type: "VFR" },
            { name: "RAMLA", lat: 31.9294, lng: 34.8667, type: "VFR" },
            { name: "LOD", lat: 31.9500, lng: 34.8883, type: "VFR" },
            { name: "REHOVOT", lat: 31.8944, lng: 34.8092, type: "VFR" },
            { name: "NES ZIONA", lat: 31.9333, lng: 34.8000, type: "VFR" },
            
            // Jerusalem Area
            { name: "JERUSALEM", lat: 31.7833, lng: 35.2167, type: "VFR" },
            { name: "MEVASSERET ZION", lat: 31.8000, lng: 35.1333, type: "VFR" },
            { name: "ABU GOSH", lat: 31.8083, lng: 35.1083, type: "VFR" },
            { name: "MOTZA", lat: 31.8000, lng: 35.1500, type: "VFR" },
            { name: "SHORESH", lat: 31.8167, lng: 35.0833, type: "VFR" },
            { name: "BEIT SHEMESH", lat: 31.7500, lng: 34.9833, type: "VFR" },
            
            // Jordan Valley & Dead Sea
            { name: "JERICHO", lat: 31.8667, lng: 35.4500, type: "VFR" },
            { name: "DEAD SEA", lat: 31.5500, lng: 35.4833, type: "VFR" },
            { name: "EIN GEDI", lat: 31.4617, lng: 35.3886, type: "VFR" },
            { name: "MASADA", lat: 31.3156, lng: 35.3539, type: "VFR" },
            { name: "EIN BOKEK", lat: 31.2000, lng: 35.3667, type: "VFR" },
            
            // Southern Israel
            { name: "BEER SHEVA", lat: 31.2500, lng: 34.7833, type: "VFR" },
            { name: "ARAD", lat: 31.2597, lng: 35.2128, type: "VFR" },
            { name: "DIMONA", lat: 31.0694, lng: 35.0339, type: "VFR" },
            { name: "YERUHAM", lat: 30.9833, lng: 34.9333, type: "VFR" },
            { name: "MITZPE RAMON", lat: 30.6097, lng: 34.8014, type: "VFR" },
            { name: "EILAT", lat: 29.5567, lng: 34.9514, type: "VFR" },
            
            // Airfields
            { name: "MEGIDDO", lat: 32.5972, lng: 35.2289, type: "Airfield" },
            { name: "HERZLIYA AIRFIELD", lat: 32.1833, lng: 34.8392, type: "Airfield" },
            { name: "HAIFA AIRFIELD", lat: 32.8094, lng: 35.0431, type: "Airfield" },
            { name: "TEL NOF", lat: 31.8397, lng: 34.8217, type: "Airfield" },
            { name: "HATZOR", lat: 31.7625, lng: 34.7272, type: "Airfield" },
            { name: "NEVATIM", lat: 31.2083, lng: 35.0119, type: "Airfield" },
            { name: "RAMON", lat: 30.7761, lng: 34.6669, type: "Airfield" },
            { name: "OVDA", lat: 29.9403, lng: 34.9358, type: "Airfield" },
            { name: "SDE DOV", lat: 32.1147, lng: 34.7822, type: "Airfield" },
            { name: "BEN GURION", lat: 32.0114, lng: 34.8867, type: "Airfield" }
        ];
        
