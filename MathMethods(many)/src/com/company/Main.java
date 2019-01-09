package com.company;

public class Main {

    public static void main(String[] args) {

        //this is exponential method
        System.out.println("this is exponential method");
        float a = 11.635f;
        System.out.printf("exp(%f) is %f",a,Math.exp(a));

        System.out.println("\n");

        //this is logarithm method
        System.out.println("this is logarithm method");
        double b = 9.465;
        System.out.printf("log(%.3f) is %.3f%n",b, Math.log(b));

        System.out.println("\n");

        //this is power method
        System.out.println("this is power method");
        double c = 9.729;
        double d = 4.987;
        System.out.printf("pow(%.3f, %.3f) is %.3f%n",c,d, Math.pow(c,d));

        System.out.println("\n");

        //this is sqrt method
        System.out.println("this is sqrt method");
        double e = 7.738;
        System.out.printf("sqrt(%.3f) is %.3f%n",e, Math.sqrt(e));

        System.out.println("\n");

        //this is sine method
        System.out.println("this is sine method");
        double degrees = 125.0;
        double radians = Math.toRadians(degrees);
        System.out.format("the sine of %.1f degrees is %.4f%n",degrees, Math.sin(radians));

        System.out.println("\n");

        //this is random method
        System.out.println("this is random method");
        System.out.println(Math.random());

        System.out.println("\n");

        //this is degree method
        System.out.println("this is degree method");
        double f = 90.0;
        double g = 45.0;
        System.out.println( Math.toDegrees(f));
        System.out.println( Math.toDegrees(g));





    }
}
