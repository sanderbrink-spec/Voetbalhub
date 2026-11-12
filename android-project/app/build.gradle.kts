import java.util.Properties
plugins {
    id("com.android.application")
}

android {
    namespace = "nl.voetbalhub.app"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = if (providers.gradleProperty("veldioPreview51").orNull == "true") "nl.voetbalhub.preview51" else "nl.voetbalhub.app1"
        manifestPlaceholders["appLabel"] = if (providers.gradleProperty("veldioPreview51").orNull == "true") "Veldio 65 Test" else "Veldio"
        minSdk = 24
        targetSdk = 36
        versionCode = 105
        versionName = "4.65"

    }

    buildFeatures {
        buildConfig = true
    }

    val signingPropertiesFile = rootProject.file("keystore.properties")
    if (signingPropertiesFile.exists()) {
        val signingProperties = Properties().apply {
            load(signingPropertiesFile.inputStream())
        }
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(signingProperties.getProperty("storeFile"))
                storePassword = signingProperties.getProperty("storePassword")
                keyAlias = signingProperties.getProperty("keyAlias")
                keyPassword = signingProperties.getProperty("keyPassword")
            }
        }
        buildTypes {
            getByName("release") {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")

}
